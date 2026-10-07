import { descadastrar } from "@/app/descadastro/[token]/acao";

/**
 * One-click unsubscribe (RFC 8058): o Gmail e outros fazem POST aqui
 * quando o destinatário clica em "Cancelar inscrição" na própria caixa.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await descadastrar(token).catch(() => false);
  return new Response(ok ? "ok" : "token inválido", { status: ok ? 200 : 400 });
}
