/**
 * Gera `src/db/esquema-conta.ts`: o esquema completo que um banco de
 * assinante nasce tendo. Aplica todas as migrações num arquivo vazio
 * (as mesmas da produção), roda as automáticas e copia o resultado.
 *
 *   npx tsx scripts/gerar-esquema-conta.ts
 *
 * Rode de novo sempre que entrar migração nova em db/migracoes.
 */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@libsql/client";

/** Tabelas que só existem no banco principal (controle do SaaS) ou são restos de migração. */
const FORA = /^(bak|contas$|usuarios$|planos$|faturas$|uso_contas$|redefinicoes_senha$|sqlite_|.*_nova$)/;

async function main() {
  const pasta = mkdtempSync(join(tmpdir(), "vynexa-esquema-"));
  const banco = createClient({ url: `file:${join(pasta, "e.db").replace(/\\/g, "/")}` });
  const dir = join(process.cwd(), "db", "migracoes");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await banco.executeMultiple(readFileSync(join(dir, f), "utf8"));

  // As migrações automáticas que mexem em esquema (não as de dados).
  const { MIGRACOES_AUTO } = await import("../src/db/esquema-auto");
  for (const m of MIGRACOES_AUTO) if (m.esquema) await m.aplicar(banco);

  const { rows } = await banco.execute(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid`);
  const sqls = rows.filter((r) => !FORA.test(String(r.tbl_name)) && !FORA.test(String(r.name))).map((r) => String(r.sql).replace(/^CREATE TABLE (?!IF NOT EXISTS)/, "CREATE TABLE IF NOT EXISTS ").replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/, "CREATE $1INDEX IF NOT EXISTS "));
  const migracoes = readdirSync(dir).filter((x) => x.endsWith(".sql")).sort();

  const saida = `// Gerado por scripts/gerar-esquema-conta.ts — não edite à mão.
/** Esquema com que nasce o banco de cada assinante. */
export const ESQUEMA_CONTA: string[] = ${JSON.stringify(sqls, null, 2)};

/** Migrações que o esquema acima já contém (ficam marcadas como aplicadas). */
export const MIGRACOES_INCLUIDAS: string[] = ${JSON.stringify([...migracoes, ...MIGRACOES_AUTO.map((m) => m.nome)])};
`;
  writeFileSync(join(process.cwd(), "src", "db", "esquema-conta.ts"), saida);
  console.log(`${sqls.length} instruções gravadas em src/db/esquema-conta.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
