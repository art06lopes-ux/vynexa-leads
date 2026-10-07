import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Client } from "@libsql/client";

/**
 * Banco de teste: um arquivo SQLite novo, numa pasta temporária, com
 * TODAS as migrações aplicadas — o mesmo esquema da produção. Cada
 * arquivo de teste roda em processo próprio (padrão do `node --test`),
 * então o cache de `getBanco()` é deste banco.
 */
export async function bancoDeTeste(): Promise<Client> {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_D1_DATABASE_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  const pasta = mkdtempSync(join(tmpdir(), "vynexa-teste-"));
  process.env.TURSO_DATABASE_URL = `file:${join(pasta, "teste.db").replace(/\\/g, "/")}`;
  process.env.SEGREDO_SESSAO ??= "segredo-de-teste-com-mais-de-32-caracteres-ok";

  const { getBanco } = await import("@/db/cliente");
  const banco = getBanco();
  const dir = join(process.cwd(), "db", "migracoes");
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await banco.executeMultiple(readFileSync(join(dir, arquivo), "utf8"));
  }
  return banco;
}

/** Um lugar mínimo para os testes de registro. */
export function lugar(extra: Partial<import("@/integrations/leads/tipos").LugarEncontrado> = {}): import("@/integrations/leads/tipos").LugarEncontrado {
  return {
    fonte: "google_places",
    externoId: `place-${Math.random().toString(36).slice(2)}`,
    fonteUrl: "https://maps.google.com/?cid=1",
    nome: "Barbearia Teste",
    categoria: "barbearia",
    categoriaRotulo: "Barbearia",
    pais: "BR",
    estado: "AM",
    cidade: "Manacapuru",
    bairro: null,
    cep: null,
    endereco: null,
    latitude: -3.29,
    longitude: -60.62,
    telefone: null,
    email: null,
    website: null,
    instagram: null,
    facebook: null,
    avaliacaoNota: null,
    avaliacaoQtd: null,
    statusNegocio: "OPERATIONAL",
    ...extra,
  };
}
