import { z } from "zod";

import { agora, getBanco } from "@/db/cliente";
import { getChavePublicaVapid } from "@/lib/push/enviar";
import { exigirSessaoNaApi } from "@/server/sessao";

/** Chave pública, para o navegador assinar. É pública mesmo — pode ir ao cliente. */
export async function GET() {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const chave = getChavePublicaVapid();
  if (chave === null) {
    return Response.json(
      { erro: "Push não configurado: falta VAPID_PUBLIC_KEY no servidor." },
      { status: 503 },
    );
  }
  return Response.json({ chavePublica: chave });
}

const Esquema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  agente: z.string().max(300).optional(),
});

/** Guarda a assinatura do aparelho. Idempotente pelo endpoint. */
export async function POST(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const analise = Esquema.safeParse(await request.json().catch(() => null));
  if (!analise.success) {
    return Response.json({ erro: "Assinatura inválida." }, { status: 400 });
  }

  const { endpoint, keys, agente } = analise.data;

  await getBanco().execute({
    // Reativar um aparelho que foi invalidado zera `invalidada_em`: o
    // usuário reinstalou o app e a assinatura nova precisa valer.
    sql: `INSERT INTO push_assinaturas (endpoint, p256dh, auth, agente, criado_em, invalidada_em)
          VALUES (?, ?, ?, ?, ?, NULL)
          ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            agente = excluded.agente,
            invalidada_em = NULL`,
    args: [endpoint, keys.p256dh, keys.auth, agente ?? null, agora()],
  });

  return Response.json({ ok: true }, { status: 201 });
}

/** Desativa este aparelho. */
export async function DELETE(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const corpo = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!corpo?.endpoint) return Response.json({ erro: "Endpoint ausente." }, { status: 400 });

  await getBanco().execute({
    sql: `DELETE FROM push_assinaturas WHERE endpoint = ?`,
    args: [corpo.endpoint],
  });

  return Response.json({ ok: true });
}
