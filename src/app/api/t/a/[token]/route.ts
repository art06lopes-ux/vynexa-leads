import { getBanco } from "@/db/cliente";
import { comTokenPublico } from "@/db/contas-banco";
import { registrarAbertura } from "@/services/rastreio-eventos";

/** Pixel de abertura: GIF transparente de 1×1. Nunca falha para o leitor. */
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  await comTokenPublico(token.replace(/\.gif$/, ""), (t) => registrarAbertura(getBanco(), t), undefined).catch(() => {});
  return new Response(GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "Content-Length": String(GIF.length) },
  });
}
