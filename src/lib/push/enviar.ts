import "server-only";

import webpush from "web-push";

import { agora, getBanco } from "@/db/cliente";

/**
 * Envio de push para os dispositivos do operador.
 *
 * Usa VAPID: um par de chaves que identifica este site perante o serviço
 * de push do navegador. Não há conta em serviço nenhum — o Google (no
 * Android) e a Apple (no iPhone) entregam de graça para quem assina com
 * uma chave válida. As chaves são geradas uma vez com `npm run push:chaves`.
 *
 * A biblioteca `web-push` cuida da criptografia (RFC 8291): ECDH, HKDF e
 * AES-GCM. Escrever isso à mão é o tipo de coisa que compila e falha em
 * silêncio no aparelho.
 */

let configurado = false;

function configurar(): boolean {
  if (configurado) return true;

  const publica = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privada = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const contato = (process.env.OSM_CONTATO ?? "").trim();

  // Sem chaves, o push simplesmente não existe — e isso não pode derrubar
  // o webhook da Stripe nem o cadastro de venda. Retorna falso e segue.
  if (publica === "" || privada === "") return false;

  webpush.setVapidDetails(
    contato ? `mailto:${contato}` : "https://github.com/art06lopes-ux/vynexa-leads",
    publica,
    privada,
  );
  configurado = true;
  return true;
}

export type Notificacao = {
  titulo: string;
  corpo: string;
  url?: string;
};

/**
 * Manda para todos os dispositivos ativos. Nunca lança.
 *
 * Falha de push é ruído, não erro: a venda já foi gravada, e derrubar a
 * resposta do webhook por causa de um celular desligado faria a Stripe
 * reenviar o evento — e o dinheiro entraria duas vezes no painel.
 */
export async function notificarTodos(n: Notificacao): Promise<{ enviados: number; removidos: number }> {
  if (!configurar()) return { enviados: 0, removidos: 0 };

  const banco = getBanco();
  const { rows } = await banco.execute(
    `SELECT endpoint, p256dh, auth FROM push_assinaturas WHERE invalidada_em IS NULL`,
  );

  let enviados = 0;
  let removidos = 0;

  const carga = JSON.stringify({ titulo: n.titulo, corpo: n.corpo, url: n.url ?? "/" });

  await Promise.all(
    rows.map(async (r) => {
      const assinatura = {
        endpoint: String(r.endpoint),
        keys: { p256dh: String(r.p256dh), auth: String(r.auth) },
      };

      try {
        await webpush.sendNotification(assinatura, carga, { TTL: 60 * 60 });
        enviados += 1;
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;

        // 404 e 410 são o serviço dizendo que aquele endpoint morreu:
        // app desinstalado, permissão revogada. Marcar evita insistir
        // para sempre num aparelho que não existe mais.
        if (status === 404 || status === 410) {
          await banco.execute({
            sql: `UPDATE push_assinaturas SET invalidada_em = ? WHERE endpoint = ?`,
            args: [agora(), assinatura.endpoint],
          });
          removidos += 1;
        }
      }
    }),
  );

  return { enviados, removidos };
}

export function getChavePublicaVapid(): string | null {
  const chave = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  return chave === "" ? null : chave;
}
