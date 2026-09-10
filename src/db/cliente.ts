import { createClient, type Client } from "@libsql/client";

/**
 * Cliente do Turso.
 *
 * O mesmo módulo serve o app na Vercel e o worker no GitHub Actions —
 * os dois leem as mesmas variáveis de ambiente. Em desenvolvimento,
 * `TURSO_DATABASE_URL=file:./local.db` faz tudo rodar contra um arquivo
 * SQLite local, sem conta no Turso e sem rede. É o mesmo motor: o que
 * funciona no arquivo funciona no Turso.
 */

let cache: Client | null = null;

export function getBanco(): Client {
  if (cache !== null) return cache;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL ausente. Copie .env.example para .env.local. Para rodar local sem conta no Turso, use file:./local.db. Ver docs/SETUP.md.",
    );
  }

  // O token não é exigido para `file:`, e exigi-lo quebraria o modo local.
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!url.startsWith("file:") && !authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN ausente. É obrigatório para bancos remotos do Turso. Ver docs/SETUP.md.",
    );
  }

  cache = createClient({ url, authToken });
  return cache;
}

/** Identificador de linha. `crypto.randomUUID` existe no Node 20+ e na Vercel. */
export function novoId(): string {
  return crypto.randomUUID();
}

/** Instante atual no mesmo formato que o `datetime('now')` do SQLite. */
export function agora(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
