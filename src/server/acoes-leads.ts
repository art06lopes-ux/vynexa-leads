"use server";

import { revalidatePath } from "next/cache";

import { agora, getBanco, novoId, ehLimiteDiarioD1, MENSAGEM_COTA_D1 } from "@/db/cliente";
import type { Empresa, StatusLead } from "@/db/tipos";
import { decidirCanal, ESQUEMA_ANALISE, montarInstrucao, validarAnalise } from "@/lib/ia/analise";
import { ErroGemini, pedirJson } from "@/lib/ia/gemini";
import { exigirSessao } from "@/server/sessao";

const ETAPAS = new Set<StatusLead>(["novo", "contatado", "respondeu", "fechado", "nao_interessado"]);

/**
 * Muda a etapa de um lead. Cria o lead se a empresa ainda não tinha —
 * mudar de etapa é o primeiro contato humano com aquela empresa, e não
 * faz sentido exigir análise de IA antes.
 *
 * `soSeNovo`: usado pelo clique no WhatsApp/e-mail, que marca "contatado"
 * sozinho. Nunca rebaixa: quem já "respondeu" não volta a "contatado"
 * porque o operador abriu a conversa de novo.
 */
export async function mudarEtapaLead(
  empresaId: string,
  etapa: StatusLead,
  opcoes: { soSeNovo?: boolean; observacao?: string } = {},
): Promise<{ ok: boolean }> {
  await exigirSessao();
  if (!ETAPAS.has(etapa) || !empresaId) return { ok: false };

  const banco = getBanco();
  const { rows } = await banco.execute({
    sql: `SELECT id, status FROM leads WHERE empresa_id = ?`,
    args: [empresaId],
  });

  const carimbo = agora();
  if (rows.length === 0) {
    await banco.execute({
      sql: `INSERT INTO leads (id, empresa_id, status, status_em, observacao) VALUES (?, ?, ?, ?, ?)`,
      args: [novoId(), empresaId, etapa, carimbo, opcoes.observacao ?? null],
    });
  } else {
    const atual = String(rows[0]!.status) as StatusLead;
    if (opcoes.soSeNovo && atual !== "novo") return { ok: true };
    await banco.execute({
      sql: `UPDATE leads
            SET status = ?, status_em = ?, observacao = COALESCE(?, observacao), atualizado_em = ?
            WHERE empresa_id = ?`,
      args: [etapa, carimbo, opcoes.observacao ?? null, carimbo, empresaId],
    });
  }

  revalidatePath("/funil");
  revalidatePath("/empresas");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Gera a abordagem de uma única empresa na hora — o botão "Gerar
 * abordagem" da tabela, para quem não quer esperar a fila do worker
 * chegar naquela empresa. Mesma lógica de `processarAnaliseIA`, só que
 * para uma linha e chamada direto da requisição do operador.
 */
export async function gerarAbordagem(empresaId: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirSessao();
  if (!empresaId) return { ok: false, erro: "Empresa inválida." };

  const banco = getBanco();
  const { rows } = await banco.execute({ sql: `SELECT * FROM empresas WHERE id = ?`, args: [empresaId] });
  const empresa = rows[0] as unknown as Empresa | undefined;
  if (!empresa) return { ok: false, erro: "Empresa não encontrada." };

  try {
    const canal = decidirCanal(empresa);
    const bruto = await pedirJson<unknown>(montarInstrucao(empresa, canal), ESQUEMA_ANALISE);
    const analise = validarAnalise(bruto);

    await banco.execute({
      sql: `INSERT INTO leads (
              id, empresa_id, score_oportunidade, motivo_problema,
              mensagem_gerada, canal_recomendado, analisado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(empresa_id) DO UPDATE SET
              score_oportunidade = excluded.score_oportunidade,
              motivo_problema    = excluded.motivo_problema,
              mensagem_gerada    = excluded.mensagem_gerada,
              canal_recomendado  = excluded.canal_recomendado,
              analisado_em       = excluded.analisado_em,
              atualizado_em      = ?`,
      args: [novoId(), empresa.id, analise.score_oportunidade, analise.motivo_problema, analise.mensagem, canal, agora(), agora()],
    });
  } catch (erro) {
    if (ehLimiteDiarioD1(erro)) return { ok: false, erro: MENSAGEM_COTA_D1 };
    const motivo = erro instanceof ErroGemini ? erro.message : erro instanceof Error ? erro.message : String(erro);
    await banco.execute({
      sql: `INSERT INTO leads (id, empresa_id, motivo_problema, analisado_em)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(empresa_id) DO UPDATE SET
              motivo_problema = excluded.motivo_problema,
              analisado_em = excluded.analisado_em,
              atualizado_em = excluded.analisado_em`,
      args: [novoId(), empresa.id, `A análise falhou: ${motivo.slice(0, 200)}`, agora()],
    });
    return { ok: false, erro: motivo };
  }

  revalidatePath("/empresas");
  revalidatePath("/funil");
  revalidatePath("/");
  return { ok: true };
}

export async function anotarLead(empresaId: string, observacao: string): Promise<{ ok: boolean }> {
  await exigirSessao();
  const texto = observacao.trim().slice(0, 500);
  await getBanco().execute({
    sql: `UPDATE leads SET observacao = ?, atualizado_em = ? WHERE empresa_id = ?`,
    args: [texto || null, agora(), empresaId],
  });
  revalidatePath("/funil");
  return { ok: true };
}
