import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";

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
 *
 * ÍNDICES. No D1, apagar uma linha conta uma escrita na tabela e mais uma
 * em cada índice: uma empresa (11 índices + 3 únicos) custa ~15 das
 * 100 mil escritas diárias, e 8 mil empresas não cabem num dia. Por isso,
 * antes de apagar, os índices comuns das tabelas são derrubados (a
 * definição fica guardada em `configuracoes`) e, no fim, recriados sobre
 * as tabelas vazias — o que não custa quase nada. Se a limpeza parar no
 * meio, os índices voltam na chamada que terminar.
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

const CHAVE_INDICES = "zerar_indices_pendentes";

type Indice = { nome: string; sql: string };

async function indicesGuardados(banco: Client): Promise<Indice[]> {
  const { rows } = await banco.execute({ sql: `SELECT valor FROM configuracoes WHERE chave = ?`, args: [CHAVE_INDICES] });
  return rows[0]?.valor ? (JSON.parse(String(rows[0].valor)) as Indice[]) : [];
}

/** Guarda a definição dos índices comuns e os derruba. Índices de UNIQUE/PK (sem `sql`) ficam. */
async function derrubarIndices(banco: Client, tabelas: string[]): Promise<void> {
  const { rows } = await banco.execute({
    sql: `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN (${tabelas.map(() => "?").join(",")})`,
    args: tabelas,
  });
  if (rows.length === 0) return;
  const guardados = await indicesGuardados(banco);
  const todos = [...guardados, ...rows.map((r) => ({ nome: String(r.name), sql: String(r.sql) })).filter((i) => !guardados.some((g) => g.nome === i.nome))];
  // Grava ANTES de derrubar: se cair no meio, a definição não se perde.
  await banco.execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [CHAVE_INDICES, JSON.stringify(todos), agora()],
  });
  for (const r of rows) await banco.execute(`DROP INDEX IF EXISTS "${String(r.name).replace(/"/g, "")}"`);
}

async function recriarIndices(banco: Client): Promise<void> {
  for (const i of await indicesGuardados(banco)) {
    await banco.execute(i.sql.replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF NOT EXISTS)/i, (_m, u: string | undefined) => `CREATE ${u ?? ""}INDEX IF NOT EXISTS `));
  }
  await banco.execute({ sql: `DELETE FROM configuracoes WHERE chave = ?`, args: [CHAVE_INDICES] });
}

export async function zerarDados(banco: Client, opcoes: { incluirVendas: boolean; orcamentoMs: number }): Promise<ResultadoZerar> {
  const inicio = Date.now();
  let apagadas = 0;

  // Jobs pendentes apontam para leads e buscas que vão sumir. O que está
  // rodando agora fica (termina sozinho e não acha mais o que processar).
  await banco.execute(`DELETE FROM jobs WHERE status <> 'em_andamento'`);

  const tabelas = tabelasParaZerar(opcoes.incluirVendas);
  if ((await contarRestantes(banco, opcoes.incluirVendas)) > 0) await derrubarIndices(banco, tabelas);

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

  await recriarIndices(banco);
  return { concluido: true, apagadas, restantes: 0, tabelaAtual: null };
}
