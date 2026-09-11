import { NextResponse, type NextRequest } from "next/server";

import { NOME_COOKIE, sessaoValida } from "@/lib/auth";

/**
 * Tranca do painel.
 *
 * `proxy.ts` e não `middleware.ts`: no Next.js 16 o segundo está
 * descontinuado e renomeado para o primeiro.
 *
 * A verificação se repete dentro das rotas de API e do layout do painel.
 * Proteger só aqui já foi origem de falhas conhecidas — uma rota pode ser
 * chamada por caminho que o `matcher` não cobre, e aí a tranca não existe.
 */

/**
 * Rotas que não exigem sessão.
 *
 * O webhook da Stripe está aqui porque quem chama é a Stripe, não o
 * operador — sem sessão, ele seria redirecionado para o login e a
 * Stripe receberia um 307 em vez do 200 que espera, desativando o
 * endpoint depois de algumas tentativas. A proteção dele não é a
 * sessão: é a assinatura HMAC, conferida dentro da própria rota.
 */
const PUBLICAS = [
  "/login",
  "/api/webhooks",
  // O navegador busca o manifesto SEM cookies, e o service worker precisa
  // existir mesmo depois de a sessão expirar — senão a instalação como
  // aplicativo falha em silêncio e a notificação nunca chega. Nenhum dos
  // dois tem conteúdo sensível: são o nome do app e um script público.
  "/manifest.webmanifest",
  "/sw.js",
  "/icones",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ehPublica = PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const autenticado = await sessaoValida(request.cookies.get(NOME_COOKIE)?.value);

  if (!autenticado && !ehPublica) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("destino", pathname);
    return NextResponse.redirect(login);
  }

  if (autenticado && pathname === "/login") {
    const painel = request.nextUrl.clone();
    painel.pathname = "/";
    painel.search = "";
    return NextResponse.redirect(painel);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
