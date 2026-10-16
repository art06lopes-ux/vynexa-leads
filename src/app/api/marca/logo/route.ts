import { getBanco } from "@/db/cliente";
import { comConta, CONTA_PRINCIPAL } from "@/db/contas-banco";

/**
 * O logo enviado em Configurações. Rota pública de propósito: ele aparece
 * nos e-mails, abertos fora do painel. Não há nada sensível num logo.
 */
export async function GET(req: Request) {
  // `?c=` = logo de um assinante (link do e-mail dele). Sem `c`, a conta da sessão (ou a do dono).
  const c = new URL(req.url).searchParams.get("c");
  const ler = () => getBanco().execute(`SELECT valor FROM configuracoes WHERE chave = 'logo_data'`);
  const { rows } = c && /^[a-z0-9-]{1,64}$/i.test(c) && c !== CONTA_PRINCIPAL ? await comConta(c, ler).catch(() => ({ rows: [] as Array<Record<string, unknown>> })) : await ler();
  const dados = rows[0]?.valor ? String(rows[0].valor) : null;
  const m = dados ? /^data:(image\/(png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(dados) : null;
  if (!m) return new Response("Sem logo.", { status: 404 });

  return new Response(Buffer.from(m[3], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "public, max-age=3600",
      // SVG enviado pelo operador não pode executar script no nosso domínio.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
