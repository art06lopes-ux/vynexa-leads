import { getBanco } from "@/db/cliente";
import { comTokenPublico, separarTokenPublico } from "@/db/contas-banco";
import { assinaturaConfere } from "@/services/rastreio";
import { registrarClique } from "@/services/rastreio-eventos";

/**
 * Link rastreado. Só redireciona se a assinatura bater com token+destino
 * — sem isso, a rota seria um redirecionador aberto usado para phishing.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await ctx.params;
  const { token } = separarTokenPublico(decodeURIComponent(bruto));
  const url = new URL(req.url);
  const destino = url.searchParams.get("u") ?? "";
  const assinatura = url.searchParams.get("s") ?? "";

  if (!/^https?:\/\//i.test(destino) || !(await assinaturaConfere(token, destino, assinatura).catch(() => false))) {
    return new Response("Link inválido.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  await comTokenPublico(bruto, (t) => registrarClique(getBanco(), t, destino), undefined).catch(() => {});
  return Response.redirect(destino, 302);
}
