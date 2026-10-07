import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { StatusCampanha } from "@/db/tipos";
import { ehProvedorEmail, type NomeProvedorEmail } from "@/integrations/email";
import { eventoSql } from "@/services/eventos";
import { novoToken } from "@/services/rastreio";

/**
 * Campanhas: montar, preparar, autorizar, pausar, cancelar.
 *
 * O ciclo de vida, e a trava que importa:
 *
 *   rascunho → preparando (IA escreve cada e-mail) → pronta
 *            → [operador vê os previews e AUTORIZA] → agendada | enviando
 *            → concluida
 *
 * Nada sai sem `autorizada_em`. O worker só pega campanhas autorizadas,
 * e só os envios cujo `agendado_para` já passou, no ritmo configurado.
 */

export type NovaCampanha = {
  nome: string;
  descricao: string | null;
  leadIds: string[];
  filtros: Record<string, unknown> | null;
  provedorEmail: NomeProvedorEmail;
  ritmoPorHora: number;
  limiteDiario: number;
  followupDias: number[];
};

export type ResultadoCriacao = {
  id: string;
  incluidos: number;
  semEmail: number;
  bloqueados: number;
  jaContatados: number;
};

const MAX_PARAMS = 90;

export function validarNovaCampanha(c: NovaCampanha): string | null {
  if (c.nome.trim().length < 3) return "Dê um nome à campanha.";
  if (c.leadIds.length === 0) return "Selecione ao menos um lead.";
  if (c.leadIds.length > 1000) return "Uma campanha aceita até 1000 leads.";
  if (!ehProvedorEmail(c.provedorEmail)) return "Provedor de e-mail inválido.";
  if (c.ritmoPorHora < 1 || c.ritmoPorHora > 120) return "Ritmo deve ficar entre 1 e 120 e-mails por hora.";
  if (c.limiteDiario < 1 || c.limiteDiario > 500) return "Limite diário deve ficar entre 1 e 500.";
  if (c.followupDias.length > 3) return "No máximo 3 follow-ups.";
  if (c.followupDias.some((d) => !Number.isInteger(d) || d < 1 || d > 60)) return "Dias de follow-up entre 1 e 60.";
  const ordenados = [...c.followupDias].sort((a, b) => a - b);
  if (ordenados.some((d, i) => d !== c.followupDias[i]) || new Set(ordenados).size !== ordenados.length) {
    return "Os dias de follow-up precisam ser crescentes, sem repetir.";
  }
  return null;
}

export async function criarCampanha(banco: Client, c: NovaCampanha): Promise<ResultadoCriacao> {
  const erro = validarNovaCampanha(c);
  if (erro) throw new Error(erro);

  const leads: Array<{ lead_id: string; email: string | null; nao_contatar: number; etapa: string }> = [];
  const unicos = [...new Set(c.leadIds)];
  for (let i = 0; i < unicos.length; i += MAX_PARAMS) {
    const lote = unicos.slice(i, i + MAX_PARAMS);
    const { rows } = await banco.execute({
      sql: `SELECT l.id AS lead_id, e.email, e.nao_contatar, l.etapa FROM leads l JOIN empresas e ON e.id = l.empresa_id
            WHERE l.id IN (${lote.map(() => "?").join(",")})`,
      args: lote,
    });
    leads.push(...(rows as unknown as typeof leads));
  }

  const bloqueados = leads.filter((l) => Number(l.nao_contatar) === 1).length;
  const semEmail = leads.filter((l) => Number(l.nao_contatar) !== 1 && !l.email).length;
  // Quem já está em negociação, proposta ou fechado não recebe e-mail frio.
  const jaContatados = leads.filter((l) => Number(l.nao_contatar) !== 1 && l.email && ["negociacao", "proposta", "fechado", "perdido"].includes(l.etapa)).length;
  const aptos = leads.filter((l) => Number(l.nao_contatar) !== 1 && l.email && !["negociacao", "proposta", "fechado", "perdido"].includes(l.etapa));
  if (aptos.length === 0) throw new Error("Nenhum dos leads selecionados pode receber e-mail (sem e-mail, bloqueados ou já em negociação).");

  const id = novoId();
  const instante = agora();
  const statements: InStatement[] = [
    {
      sql: `INSERT INTO campanhas (id, nome, descricao, status, canal, filtros, provedor_email, ritmo_por_hora, limite_diario,
                                   followup_ativo, followup_dias, total_leads, criado_em, atualizado_em)
            VALUES (?, ?, ?, 'preparando', 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, c.nome.trim(), c.descricao, c.filtros ? JSON.stringify(c.filtros) : null, c.provedorEmail, c.ritmoPorHora, c.limiteDiario,
        c.followupDias.length > 0 ? 1 : 0, c.followupDias.length > 0 ? JSON.stringify(c.followupDias) : null, aptos.length, instante, instante,
      ],
    },
  ];
  for (const l of aptos) {
    statements.push({ sql: `INSERT OR IGNORE INTO campanha_leads (campanha_id, lead_id) VALUES (?, ?)`, args: [id, l.lead_id] });
    for (let passo = 0; passo <= c.followupDias.length; passo += 1) {
      statements.push({
        sql: `INSERT OR IGNORE INTO envios (id, campanha_id, lead_id, canal, passo, destinatario, status, token, criado_em, atualizado_em)
              VALUES (?, ?, ?, 'email', ?, ?, 'pendente', ?, ?, ?)`,
        args: [novoId(), id, l.lead_id, passo, l.email, novoToken(), instante, instante],
      });
    }
    statements.push(eventoSql(l.lead_id, "adicionado_campanha", `Adicionado à campanha "${c.nome.trim()}"`, { campanhaId: id }));
  }
  statements.push({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'preparar_campanha', ?, 'pendente')`,
    args: [novoId(), JSON.stringify({ campanhaId: id })],
  });

  for (let i = 0; i < statements.length; i += 40) await banco.batch(statements.slice(i, i + 40), "write");
  return { id, incluidos: aptos.length, semEmail, bloqueados, jaContatados };
}

/**
 * O operador viu os previews e confirmou. Sem esta chamada, nada sai.
 * `quando` nulo = enviar agora (no ritmo da campanha).
 */
export async function autorizarCampanha(banco: Client, campanhaId: string, quando: string | null): Promise<void> {
  const { rows } = await banco.execute({ sql: `SELECT status FROM campanhas WHERE id = ?`, args: [campanhaId] });
  const status = rows[0]?.status as StatusCampanha | undefined;
  if (!status) throw new Error("Campanha não encontrada.");
  if (status !== "pronta" && status !== "pausada") throw new Error("A campanha só pode ser autorizada quando todos os e-mails estiverem preparados.");

  const instante = agora();
  const inicio = quando && quando > instante ? quando : instante;
  await banco.batch(
    [
      {
        sql: `UPDATE campanhas SET status = ?, autorizada_em = COALESCE(autorizada_em, ?), agendada_para = ?, atualizado_em = ? WHERE id = ?`,
        args: [inicio > instante ? "agendada" : "enviando", instante, inicio, instante, campanhaId],
      },
      // Só a primeira abordagem é agendada agora; os follow-ups esperam o
      // primeiro envio de cada lead (ver `enviarUm`).
      {
        sql: `UPDATE envios SET status = 'agendado', agendado_para = ?, atualizado_em = ? WHERE campanha_id = ? AND passo = 0 AND status = 'preparado'`,
        args: [inicio, instante, campanhaId],
      },
      {
        sql: `INSERT INTO jobs (id, tipo, payload, status, disponivel_em) VALUES (?, 'enviar_campanha', ?, 'pendente', ?)`,
        args: [novoId(), JSON.stringify({ campanhaId }), inicio],
      },
    ],
    "write",
  );
}

export async function pausarCampanha(banco: Client, campanhaId: string): Promise<void> {
  await banco.execute({
    sql: `UPDATE campanhas SET status = 'pausada', atualizado_em = ? WHERE id = ? AND status IN ('agendada','enviando')`,
    args: [agora(), campanhaId],
  });
}

export async function cancelarCampanha(banco: Client, campanhaId: string): Promise<void> {
  const instante = agora();
  await banco.batch(
    [
      {
        sql: `UPDATE campanhas SET status = 'cancelada', atualizado_em = ? WHERE id = ? AND status NOT IN ('concluida','cancelada')`,
        args: [instante, campanhaId],
      },
      {
        sql: `UPDATE envios SET status = 'cancelado', atualizado_em = ? WHERE campanha_id = ? AND status IN ('pendente','preparado','agendado')`,
        args: [instante, campanhaId],
      },
    ],
    "write",
  );
}

/** Edita o texto de um envio ainda não enviado (pelo preview). */
export async function editarEnvio(banco: Client, envioId: string, assunto: string, corpo: string): Promise<void> {
  if (/[\r\n]/.test(assunto)) throw new Error("O assunto não pode ter quebra de linha.");
  if (assunto.trim().length < 3 || corpo.trim().length < 20) throw new Error("Assunto e corpo precisam de conteúdo.");
  const { rowsAffected } = await banco.execute({
    // Texto escrito à mão num envio que a IA não conseguiu preparar: passa
    // a "preparado" e entra no próximo agendamento.
    sql: `UPDATE envios SET assunto = ?, corpo = ?, erro = NULL, atualizado_em = ?,
                 status = CASE WHEN status IN ('pendente','erro') THEN 'preparado' ELSE status END
          WHERE id = ? AND status IN ('pendente','preparado','agendado','erro') AND enviado_em IS NULL`,
    args: [assunto.trim(), corpo.trim(), agora(), envioId],
  });
  if (rowsAffected === 0) throw new Error("Este e-mail já foi enviado e não pode mais ser editado.");
}

/** Fecha a campanha quando não sobra nada a enviar. */
export async function concluirSeTerminou(banco: Client, campanhaId: string): Promise<boolean> {
  const { rows } = await banco.execute({
    sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND status IN ('pendente','preparado','agendado','enviando')`,
    args: [campanhaId],
  });
  if (Number(rows[0]?.n ?? 0) > 0) return false;
  const { rowsAffected } = await banco.execute({
    sql: `UPDATE campanhas SET status = 'concluida', concluida_em = ?, atualizado_em = ? WHERE id = ? AND status IN ('enviando','agendada')`,
    args: [agora(), agora(), campanhaId],
  });
  return rowsAffected > 0;
}
