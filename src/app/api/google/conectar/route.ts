import { cookies } from "next/headers";

import { OPCOES_COOKIE } from "@/lib/auth";
import { ErroGoogle, urlDeAutorizacao } from "@/lib/google/oauth";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Início do OAuth: manda para a tela de consentimento do Google.
 *
 * O `state` é um valor aleatório guardado em cookie e conferido no
 * callback. Sem ele, um link forjado poderia ligar a conta Google de
 * outra pessoa ao seu painel.
 */
export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const estado = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_estado", estado, { ...OPCOES_COOKIE, maxAge: 600 });

  try {
    return Response.redirect(urlDeAutorizacao(new URL(request.url).origin, estado), 302);
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof ErroGoogle ? erro.message : "Falha ao iniciar a conexão." },
      { status: 500 },
    );
  }
}
