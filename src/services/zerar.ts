import type { Client } from "@libsql/client";

/**
 * "Começar do zero": apaga a carteira (empresas, leads e tudo que pende
 * deles) e mantém o que é configuração — identidade, chaves de API,
 * produtos, aparelhos de push — e a lista de supressão, que é obrigação
 * legal: quem pediu para não ser contatado continua bloqueado mesmo se
 * reaparecer numa busca nova.
 *
 * Apaga em lotes, filhos antes dos pais. O D1 gratuito tem cota diária de
 * linhas escritas, e cada linha apagada de `empresas` conta também em
 * cada índice; uma carteira grande pode não caber num dia. Por isso a
 * função para no orçamento de tempo (ou na cota), diz quanto falta, e
 * pode ser chamada de novo — continua de onde parou.
 */

const LOTE = 1500;

/** Ordem de remoção. Vendas e cobranças só entram se pedido. */
export function tabelasParaZerar(incluirVendas: boolean): string[] {
  return [
    "busca_resultados",
    "eventos",
    "mensagens",
    "propostas",
    "envios",
    "campanha_leads",
    "campanhas",
    ...(incluirVendas ? ["cobrancas", "webhook_eventos", "vendas"] : []),
    "notificacoes",
    "leads",
    "empresas",
    "buscas",
  ];
}

export type ResultadoZerar = { concluido: boolean; apagadas: number; restantes: number; tabelaAtual: string | null };

export async function contarRestantes(banco: Client, incluirVendas: boolean): Promise<number> {
  let total = 0;
  for (const t of tabelasParaZerar(incluirVendas)) {
    const { rows } = await banco.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    total += Number(rows[0]?.n ?? 0);
  }
  return total;
}

export async function zerarDados(banco: Client, opcoes: { incluirVendas: boolean; orcamentoMs: number }): Promise<ResultadoZerar> {
  const inicio = Date.now();
  let apagadas = 0;

  // Jobs pendentes apontam para leads e buscas que vão sumir. O que está
  // rodando agora fica (termina sozinho e não acha mais o que processar).
  await banco.execute(`DELETE FROM jobs WHERE status <> 'em_andamento'`);

  for (const tabela of tabelasParaZerar(opcoes.incluirVendas)) {
    for (;;) {
      if (Date.now() - inicio > opcoes.orcamentoMs) {
        return { concluido: false, apagadas, restantes: await contarRestantes(banco, opcoes.incluirVendas), tabelaAtual: tabela };
      }
      const { rowsAffected } = await banco.execute(`DELETE FROM ${tabela} WHERE rowid IN (SELECT rowid FROM ${tabela} LIMIT ${LOTE})`);
      apagadas += rowsAffected;
      if (rowsAffected < LOTE) break;
    }
  }

  return { concluido: true, apagadas, restantes: 0, tabelaAtual: null };
}
