import { getSegredoSessao, getSenhaPainel } from "@/lib/ambiente";

/**
 * Sessão por senha única, em cookie assinado.
 *
 * A ferramenta tem um usuário só e vive numa URL pública da Vercel, então
 * o que se precisa é de uma tranca, não de um sistema de identidade.
 * Um cookie assinado com HMAC resolve sem serviço externo, sem banco de
 * usuários e sem dependência nova.
 *
 * O cookie guarda `expiraEm.assinatura`. Ele não guarda a senha, e a
 * assinatura cobre o prazo — sem isso, alterar a data no cookie
 * estenderia a sessão para sempre.
 *
 * WebCrypto e não `node:crypto`: o proxy roda no runtime Edge, onde o
 * módulo do Node não existe.
 */

const DURACAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
export const NOME_COOKIE = "vynexa_sessao";

async function chave(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSegredoSessao()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function paraHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function assinar(mensagem: string): Promise<string> {
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chave(),
    new TextEncoder().encode(mensagem),
  );
  return paraHex(assinatura);
}

/**
 * Comparação em tempo constante.
 *
 * `a === b` sai no primeiro byte diferente, e essa diferença de tempo é
 * mensurável pela rede — é assim que se forja uma assinatura byte a byte.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

/** Confere a senha digitada, também em tempo constante. */
export function senhaCorreta(tentativa: string): boolean {
  return iguaisEmTempoConstante(tentativa, getSenhaPainel());
}

export async function criarValorDeSessao(): Promise<{ valor: string; expiraEm: Date }> {
  const expiraEm = new Date(Date.now() + DURACAO_MS);
  const marca = String(expiraEm.getTime());
  return { valor: `${marca}.${await assinar(marca)}`, expiraEm };
}

export async function sessaoValida(valor: string | undefined): Promise<boolean> {
  if (!valor) return false;

  const separador = valor.lastIndexOf(".");
  if (separador <= 0) return false;

  const marca = valor.slice(0, separador);
  const assinatura = valor.slice(separador + 1);

  const prazo = Number(marca);
  if (!Number.isFinite(prazo) || prazo < Date.now()) return false;

  // A assinatura é conferida depois do prazo de propósito: um cookie
  // vencido não merece o custo do HMAC.
  return iguaisEmTempoConstante(assinatura, await assinar(marca));
}

export const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // A Vercel serve tudo em HTTPS; em `next dev` no localhost, um cookie
  // `secure` nunca seria aceito e o login não fecharia o ciclo.
  secure: process.env.NODE_ENV === "production",
} as const;
