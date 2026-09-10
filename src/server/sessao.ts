import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NOME_COOKIE, sessaoValida } from "@/lib/auth";

/**
 * Segunda camada da tranca.
 *
 * O proxy já barra a navegação, mas o `matcher` é uma expressão regular
 * e uma rota nova pode escapar dele sem ninguém perceber. Cada rota de
 * API e cada página protegida confere por conta própria — é barato e
 * remove a chance de um buraco silencioso.
 */
export async function temSessao(): Promise<boolean> {
  const cookieStore = await cookies();
  return sessaoValida(cookieStore.get(NOME_COOKIE)?.value);
}

/** Para páginas: manda ao login quando não há sessão. */
export async function exigirSessao(): Promise<void> {
  if (!(await temSessao())) redirect("/login");
}

/** Para rotas de API: devolve 401 em vez de redirecionar. */
export async function exigirSessaoNaApi(): Promise<Response | null> {
  if (await temSessao()) return null;
  return Response.json({ erro: "Não autenticado." }, { status: 401 });
}
