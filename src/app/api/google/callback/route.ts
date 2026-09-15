import { cookies } from "next/headers";

import { concluirConexao, ErroGoogle } from "@/lib/google/oauth";
import { exigirSessaoNaApi } from "@/server/sessao";

/** Volta do Google com o código. Troca por tokens e guarda a conta. */
export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const estado = url.searchParams.get("state");
  const erroGoogle = url.searchParams.get("error");

  const cookieStore = await cookies();
  const esperado = cookieStore.get("google_oauth_estado")?.value;
  cookieStore.delete("google_oauth_estado");

  const voltar = (mensagem: string, ok: boolean) =>
    Response.redirect(`${url.origin}/ajustes?google=${ok ? "ok" : "erro"}&msg=${encodeURIComponent(mensagem)}`, 302);

  if (erroGoogle) return voltar(`O Google recusou: ${erroGoogle}`, false);
  if (!codigo || !estado || !esperado || estado !== esperado) {
    return voltar("Estado inválido — tente conectar de novo.", false);
  }

  try {
    const email = await concluirConexao(url.origin, codigo);
    return voltar(`Conectado como ${email}`, true);
  } catch (erro) {
    return voltar(erro instanceof ErroGoogle ? erro.message : "Falha ao concluir a conexão.", false);
  }
}
