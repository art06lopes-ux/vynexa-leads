import type { Client, InStatement } from "@libsql/client";

import { agora } from "@/db/cliente";
import { eventoSql } from "@/services/eventos";
import { dominioProprio, normalizarEmail, telefoneE164 } from "@/services/normalizacao";

/**
 * Lista de supressão — "não contatar".
 *
 * Quando alguém pede para não receber mais mensagens (link de
 * descadastro, resposta pedindo, marcação manual), a empresa é marcada
 * `nao_contatar = 1` E os contatos dela entram na lista. A lista é o que
 * protege o futuro: se a mesma empresa aparecer de novo numa busca, por
 * outra fonte, o registro já nasce bloqueado (`services/registro.ts`).
 *
 * Toda campanha e todo envio conferem `nao_contatar` antes de sair.
 */

export type OrigemSupressao = "descadastro" | "manual" | "resposta";

export async function marcarNaoContatar(
  banco: Client,
  empresaId: string,
  motivo: string,
  origem: OrigemSupressao,
): Promise<void> {
  const { rows } = await banco.execute({
    sql: `SELECT e.id, e.email, e.telefone, e.pais, e.website, e.place_id, l.id AS lead_id
          FROM empresas e LEFT JOIN leads l ON l.empresa_id = e.id WHERE e.id = ?`,
    args: [empresaId],
  });
  const e = rows[0];
  if (!e) throw new Error("Empresa não encontrada.");

  const instante = agora();
  const itens: Array<[string, string | null]> = [
    ["email", normalizarEmail(e.email as string | null)],
    ["telefone", telefoneE164(e.telefone as string | null, String(e.pais))],
    ["dominio", dominioProprio(e.website as string | null)],
    ["place_id", (e.place_id as string | null) ?? null],
  ];

  const statements: InStatement[] = [
    {
      sql: `UPDATE empresas SET nao_contatar = 1, nao_contatar_motivo = ?, nao_contatar_em = ?, atualizado_em = ? WHERE id = ?`,
      args: [motivo.slice(0, 300), instante, instante, empresaId],
    },
    // Envios ainda não enviados desta empresa são cancelados na hora.
    {
      sql: `UPDATE envios SET status = 'cancelado', erro = 'Contato pediu para não receber mensagens', atualizado_em = ?
            WHERE lead_id = ? AND status IN ('pendente','preparado','agendado')`,
      args: [instante, (e.lead_id as string | null) ?? ""],
    },
  ];
  for (const [tipo, valor] of itens) {
    if (!valor) continue;
    statements.push({
      sql: `INSERT OR IGNORE INTO supressao (tipo, valor, motivo, origem, criado_em) VALUES (?, ?, ?, ?, ?)`,
      args: [tipo, valor, motivo.slice(0, 300), origem, instante],
    });
  }
  if (e.lead_id) statements.push(eventoSql(String(e.lead_id), "nao_contatar", `Marcado como não contatar: ${motivo}`, { origem }));

  await banco.batch(statements, "write");
}

export async function removerDaSupressao(banco: Client, tipo: string, valor: string): Promise<void> {
  await banco.execute({ sql: `DELETE FROM supressao WHERE tipo = ? AND valor = ?`, args: [tipo, valor] });
}

export async function adicionarSupressaoManual(banco: Client, tipo: "email" | "telefone" | "dominio", bruto: string, pais = "BR"): Promise<string> {
  const valor =
    tipo === "email" ? normalizarEmail(bruto) : tipo === "telefone" ? telefoneE164(bruto, pais) : dominioProprio(bruto.includes(".") ? bruto : null);
  if (!valor) throw new Error(`Valor inválido para ${tipo}.`);
  await banco.execute({
    sql: `INSERT OR IGNORE INTO supressao (tipo, valor, motivo, origem, criado_em) VALUES (?, ?, 'Adicionado manualmente', 'manual', ?)`,
    args: [tipo, valor, agora()],
  });
  // Empresas que já estão na carteira com este contato ficam bloqueadas também.
  const coluna = tipo === "email" ? "email" : tipo === "telefone" ? "telefone_e164" : "dominio";
  await banco.execute({
    sql: `UPDATE empresas SET nao_contatar = 1, nao_contatar_motivo = 'Na lista de supressão', nao_contatar_em = ? WHERE ${coluna} = ? AND nao_contatar = 0`,
    args: [agora(), valor],
  });
  return valor;
}
