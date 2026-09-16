"use server";

import { revalidatePath } from "next/cache";

import { agora, getBanco, novoId } from "@/db/cliente";
import type { StatusLead } from "@/db/tipos";
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
