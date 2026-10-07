"use server";

import { redirect } from "next/navigation";

import { getBanco } from "@/db/cliente";
import { notificar } from "@/integrations/notificacoes";
import { marcarNaoContatar } from "@/services/supressao";

/** Ação pública (sem sessão): só o dono do token chega aqui. */
export async function confirmarDescadastro(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  await descadastrar(token);
  redirect(`/descadastro/${encodeURIComponent(token)}?feito=1`);
}

export async function descadastrar(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return false;
  const banco = getBanco();
  const { rows } = await banco.execute({
    sql: `SELECT e.id, e.nome, e.nao_contatar, l.id lead_id FROM envios en JOIN leads l ON l.id = en.lead_id JOIN empresas e ON e.id = l.empresa_id WHERE en.token = ?`,
    args: [token],
  });
  const alvo = rows[0];
  if (!alvo) return false;
  if (Number(alvo.nao_contatar) === 1) return true;
  await marcarNaoContatar(banco, String(alvo.id), "Pediu pelo link do e-mail", "descadastro");
  await notificar(banco, { tipo: "resposta", titulo: "Pedido de descadastro", corpo: `${alvo.nome} pediu para não receber mais mensagens. Marcado como NÃO CONTATAR.`, link: `/leads/${alvo.lead_id}` });
  return true;
}
