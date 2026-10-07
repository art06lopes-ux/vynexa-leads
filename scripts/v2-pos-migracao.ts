/**
 * Depois da migração 0012: preenche as chaves de dedup (nome, endereço,
 * telefone E.164, domínio) das empresas antigas e recalcula o score de
 * todos os leads com as regras da v2. Idempotente — pode rodar de novo.
 *
 *   npm run v2:pos-migracao
 */
import { getBanco } from "../src/db/cliente";
import { chaveEndereco, chaveNome, dominioProprio, telefoneE164 } from "../src/services/normalizacao";
import { recalcularScores } from "../src/services/registro";

async function main() {
  const banco = getBanco();
  let depois = "";
  let total = 0;
  for (;;) {
    const { rows } = await banco.execute({
      sql: `SELECT id, nome, endereco, telefone, pais, website FROM empresas WHERE id > ? ORDER BY id LIMIT 200`,
      args: [depois],
    });
    if (rows.length === 0) break;
    const statements = rows.map((r) => ({
      sql: `UPDATE empresas SET nome_chave = ?, endereco_chave = ?, telefone_e164 = ?, dominio = ? WHERE id = ?`,
      args: [
        chaveNome(String(r.nome)),
        chaveEndereco(r.endereco as string | null),
        telefoneE164(r.telefone as string | null, String(r.pais)),
        dominioProprio(r.website as string | null),
        String(r.id),
      ],
    }));
    for (let i = 0; i < statements.length; i += 50) await banco.batch(statements.slice(i, i + 50), "write");
    await recalcularScores(banco, rows.map((r) => String(r.id)));
    total += rows.length;
    depois = String(rows[rows.length - 1].id);
    console.log(`  ${total} empresas processadas`);
  }
  console.log(`Concluído: ${total} empresas com chaves e score v2.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
