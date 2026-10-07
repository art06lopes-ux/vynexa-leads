import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";
import { notificar } from "@/integrations/notificacoes";
import { eventoSql } from "@/services/eventos";

/**
 * Abertura, clique e entrega de um envio. Cada um só conta uma vez
 * (COALESCE no carimbo) e só "promove" o status — um clique não volta a
 * ser "aberto", uma resposta não volta a ser "clicado".
 */

const ORDEM = ["enviado", "entregue", "aberto", "clicado", "respondeu"];

async function envioPorToken(banco: Client, token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const { rows } = await banco.execute({
    sql: `SELECT id, lead_id, campanha_id, status, aberto_em, clicado_em, entregue_em FROM envios WHERE token = ?`,
    args: [token],
  });
  return rows[0] ?? null;
}

function promover(atual: string, novo: string): string {
  const a = ORDEM.indexOf(atual);
  const n = ORDEM.indexOf(novo);
  return a === -1 || n > a ? novo : atual;
}

export async function registrarAbertura(banco: Client, token: string): Promise<void> {
  const e = await envioPorToken(banco, token);
  if (!e || e.aberto_em) return;
  const instante = agora();
  await banco.batch(
    [
      { sql: `UPDATE envios SET aberto_em = ?, status = ?, atualizado_em = ? WHERE id = ? AND aberto_em IS NULL`, args: [instante, promover(String(e.status), "aberto"), instante, String(e.id)] },
      ...(e.campanha_id ? [{ sql: `UPDATE campanhas SET abertos = abertos + 1 WHERE id = ?`, args: [String(e.campanha_id)] }] : []),
      eventoSql(String(e.lead_id), "email_aberto", "E-mail aberto"),
    ],
    "write",
  );
}

export async function registrarClique(banco: Client, token: string, url: string): Promise<void> {
  const e = await envioPorToken(banco, token);
  if (!e) return;
  const instante = agora();
  const primeiro = !e.clicado_em;
  await banco.batch(
    [
      {
        sql: `UPDATE envios SET clicado_em = COALESCE(clicado_em, ?), aberto_em = COALESCE(aberto_em, ?), status = ?, atualizado_em = ? WHERE id = ?`,
        args: [instante, instante, promover(String(e.status), "clicado"), instante, String(e.id)],
      },
      ...(primeiro && e.campanha_id ? [{ sql: `UPDATE campanhas SET cliques = cliques + 1 WHERE id = ?`, args: [String(e.campanha_id)] }] : []),
      ...(primeiro ? [eventoSql(String(e.lead_id), "email_clicado", `Clicou no link: ${url.slice(0, 200)}`)] : []),
    ],
    "write",
  );
  if (primeiro) {
    const { rows } = await banco.execute({ sql: `SELECT e.nome FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE l.id = ?`, args: [String(e.lead_id)] });
    await notificar(banco, { tipo: "resposta", titulo: "Lead clicou no seu e-mail", corpo: `${rows[0]?.nome ?? "Um lead"} abriu o link do e-mail.`, link: `/leads/${e.lead_id}` });
  }
}

export async function registrarEntrega(banco: Client, provedorMessageId: string, tipo: "entregue" | "aberto" | "clicado" | "devolvido"): Promise<boolean> {
  const { rows } = await banco.execute({ sql: `SELECT id, token, status FROM envios WHERE provedor_message_id = ?`, args: [provedorMessageId] });
  const e = rows[0];
  if (!e) return false;
  const instante = agora();
  if (tipo === "entregue") {
    await banco.execute({ sql: `UPDATE envios SET entregue_em = COALESCE(entregue_em, ?), status = ?, atualizado_em = ? WHERE id = ?`, args: [instante, promover(String(e.status), "entregue"), instante, String(e.id)] });
  } else if (tipo === "devolvido") {
    await banco.execute({ sql: `UPDATE envios SET status = 'erro', erro = 'E-mail devolvido (bounce) pelo servidor do destinatário.', atualizado_em = ? WHERE id = ?`, args: [instante, String(e.id)] });
  } else if (e.token) {
    if (tipo === "aberto") await registrarAbertura(banco, String(e.token));
    else await registrarClique(banco, String(e.token), "(link do e-mail)");
  }
  return true;
}
