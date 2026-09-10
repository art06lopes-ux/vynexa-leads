/**
 * Aplicador de migrações.
 *
 * Roda os arquivos de `db/migracoes/` em ordem de nome e registra os já
 * aplicados, para ser seguro executar quantas vezes quiser. O mesmo
 * comando serve para o banco local (`file:./local.db`) e para o Turso —
 * é o `TURSO_DATABASE_URL` que decide qual.
 *
 *   npm run db:aplicar
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { getBanco } from "../src/db/cliente";

const PASTA = join(process.cwd(), "db", "migracoes");

async function main() {
  const banco = getBanco();

  await banco.execute(`
    CREATE TABLE IF NOT EXISTS migracoes_aplicadas (
      nome        TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { rows } = await banco.execute("SELECT nome FROM migracoes_aplicadas");
  const aplicadas = new Set(rows.map((r) => String(r.nome)));

  const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith(".sql")).sort();

  let novas = 0;

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) {
      console.log(`  = ${arquivo}`);
      continue;
    }

    const sql = await readFile(join(PASTA, arquivo), "utf8");

    // `executeMultiple` roda o arquivo inteiro. Não é transacional entre
    // statements no libSQL, então uma migração que falhar no meio deixa
    // trabalho pela metade — por isso cada arquivo é pequeno e o registro
    // só acontece depois que ele inteiro passou.
    await banco.executeMultiple(sql);
    await banco.execute({
      sql: "INSERT INTO migracoes_aplicadas (nome) VALUES (?)",
      args: [arquivo],
    });

    console.log(`  + ${arquivo}`);
    novas += 1;
  }

  console.log(
    novas === 0
      ? "\nBanco já estava atualizado."
      : `\n${novas} ${novas === 1 ? "migração aplicada" : "migrações aplicadas"}.`,
  );
}

main().catch((erro) => {
  console.error("\nFalhou ao aplicar migrações:\n", erro);
  process.exit(1);
});
