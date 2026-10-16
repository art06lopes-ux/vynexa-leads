import { getBanco } from "@/db/cliente";
import { comConta, CONTA_PRINCIPAL } from "@/db/contas-banco";
import { obterSegredo } from "@/integrations/segredos";
import { registrarEntrega } from "@/services/rastreio-eventos";

/**
 * Webhook do Resend (assinado pela Svix): entregue, aberto, clicado,
 * devolvido. Assinatura: HMAC-SHA256 de `id.timestamp.corpo` com o
 * segredo (base64 depois de "whsec_"), comparada com cada assinatura
 * "v1,…" do cabeçalho. Rejeita eventos com mais de 5 minutos (replay).
 */
async function assinaturaValida(segredo: string, id: string, ts: string, corpo: string, cabecalho: string): Promise<boolean> {
  const idade = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(idade) || idade > 300) return false;
  const chave = await crypto.subtle.importKey("raw", Buffer.from(segredo.replace(/^whsec_/, ""), "base64"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = Buffer.from(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${id}.${ts}.${corpo}`))).toString("base64");
  return cabecalho.split(" ").some((parte) => {
    const recebido = parte.split(",")[1] ?? "";
    if (recebido.length !== esperado.length) return false;
    let dif = 0;
    for (let i = 0; i < esperado.length; i += 1) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
    return dif === 0;
  });
}

/** Assinantes cadastram a URL com `?conta=<id>`; sem isso, é a conta do dono. */
export async function POST(request: Request) {
  const conta = new URL(request.url).searchParams.get("conta") ?? CONTA_PRINCIPAL;
  if (!/^[a-z0-9-]{1,64}$/i.test(conta)) return Response.json({ erro: "Conta inválida." }, { status: 400 });
  return comConta(conta, () => processar(request)).catch(() => Response.json({ erro: "Conta inválida." }, { status: 404 }));
}

async function processar(request: Request): Promise<Response> {
  const segredo = await obterSegredo("RESEND_WEBHOOK_SECRET");
  if (!segredo) return Response.json({ erro: "Webhook do Resend não configurado." }, { status: 503 });
  const corpo = await request.text();
  const ok = await assinaturaValida(segredo, request.headers.get("svix-id") ?? "", request.headers.get("svix-timestamp") ?? "", corpo, request.headers.get("svix-signature") ?? "").catch(() => false);
  if (!ok) return Response.json({ erro: "Assinatura inválida." }, { status: 401 });

  const evento = JSON.parse(corpo) as { type?: string; data?: { email_id?: string } };
  const mapa: Record<string, "entregue" | "aberto" | "clicado" | "devolvido"> = {
    "email.delivered": "entregue",
    "email.opened": "aberto",
    "email.clicked": "clicado",
    "email.bounced": "devolvido",
  };
  const tipo = evento.type ? mapa[evento.type] : undefined;
  if (tipo && evento.data?.email_id) await registrarEntrega(getBanco(), evento.data.email_id, tipo).catch((e) => console.error("[webhook resend]", e));
  return Response.json({ ok: true });
}
