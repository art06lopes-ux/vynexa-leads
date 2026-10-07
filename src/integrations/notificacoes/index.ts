import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";

/**
 * Notificações: a central do sino (banco) e o push no celular.
 *
 * `NotificationProvider` é o contrato; hoje há dois — o do banco, que
 * alimenta o sino e o toast de venda, e o de push (Web Push, VAPID), que
 * só existe quando as chaves estão configuradas. `notificar` manda para
 * todos e NUNCA lança: notificação que falha não pode derrubar o webhook
 * de pagamento nem o envio de uma campanha.
 */

export type TipoNotificacao =
  | "venda"
  | "pagamento"
  | "resposta"
  | "email_enviado"
  | "erro_campanha"
  | "oportunidade"
  | "campanha_concluida"
  | "busca_concluida";

export type NovaNotificacao = {
  tipo: TipoNotificacao;
  titulo: string;
  corpo?: string | null;
  link?: string | null;
  dados?: Record<string, unknown> | null;
};

export interface NotificationProvider {
  readonly nome: string;
  enviar(banco: Client, n: NovaNotificacao): Promise<void>;
}

export const notificacaoNoBanco: NotificationProvider = {
  nome: "central",
  async enviar(banco, n) {
    await banco.execute({
      sql: `INSERT INTO notificacoes (id, tipo, titulo, corpo, link, dados, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [novoId(), n.tipo, n.titulo.slice(0, 200), n.corpo?.slice(0, 1000) ?? null, n.link ?? null, n.dados ? JSON.stringify(n.dados) : null, agora()],
    });
  },
};

/**
 * Push. Importado sob demanda: `web-push` puxa `server-only` pelo módulo
 * de envio, e o worker (Node puro) não tem push configurado mesmo.
 */
export const notificacaoPush: NotificationProvider = {
  nome: "push",
  async enviar(_banco, n) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || process.env.NEXT_RUNTIME === undefined) return;
    const { notificarTodos } = await import("@/lib/push/enviar");
    await notificarTodos({ titulo: n.titulo, corpo: n.corpo ?? "", url: n.link ?? "/" });
  },
};

const provedores: NotificationProvider[] = [notificacaoNoBanco, notificacaoPush];

export async function notificar(banco: Client, n: NovaNotificacao): Promise<void> {
  await Promise.all(
    provedores.map((p) =>
      p.enviar(banco, n).catch((erro) => {
        console.error(`Notificação (${p.nome}) falhou:`, erro instanceof Error ? erro.message : erro);
      }),
    ),
  );
}
