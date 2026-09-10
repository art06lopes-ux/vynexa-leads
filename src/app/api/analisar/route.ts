import { getBanco, novoId } from "@/db/cliente";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Enfileira a análise de IA das empresas ainda sem lead.
 *
 * Como a busca, esta rota não faz o trabalho: o plano Hobby da Vercel
 * corta a função em 10 segundos e vinte chamadas ao Gemini levam bem
 * mais. Ela só cria o job e responde.
 */
export async function POST() {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const banco = getBanco();

  const { rows: pendentes } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas e
     LEFT JOIN leads l ON l.empresa_id = e.id
     WHERE l.id IS NULL`,
  );
  const total = Number(pendentes[0]?.n ?? 0);

  if (total === 0) {
    return Response.json({ enfileirado: false, pendentes: 0 });
  }

  // Um job de análise por vez. Clicar duas vezes no botão não pode
  // dobrar o consumo da cota gratuita do Gemini — e o handler já
  // enfileira a continuação sozinho quando sobra trabalho.
  const { rows: emAberto } = await banco.execute(
    `SELECT COUNT(*) AS n FROM jobs
     WHERE tipo = 'analise_ia' AND status IN ('pendente','em_andamento')`,
  );

  if (Number(emAberto[0]?.n ?? 0) > 0) {
    return Response.json({ enfileirado: false, jaNaFila: true, pendentes: total });
  }

  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
    args: [novoId(), JSON.stringify({ limite: 20 })],
  });

  return Response.json({ enfileirado: true, pendentes: total }, { status: 202 });
}
