import "server-only";

import { getBanco, planos } from "@/db/cliente";

export type ImportacaoReceita = {
  id: string;
  referencia: string;
  uf: string;
  linhas: number;
  status: "em_andamento" | "parcial" | "concluida" | "erro";
  erro: string | null;
  iniciado_em: string;
  concluido_em: string | null;
};

export type ResumoReceita = {
  /** Pasta da Receita da última importação concluída, ex.: 2026-09. */
  referencia: string | null;
  /** De onde os arquivos vieram na última importação. */
  origemArquivos: string | null;
  /** Estabelecimentos ativos na base, por estado. */
  porUf: Array<{ uf: string; total: number }>;
  ultimas: ImportacaoReceita[];
};

export async function resumoReceita(): Promise<ResumoReceita> {
  const banco = getBanco();
  // `porUf` vem do registro da importação, nunca de COUNT(*) na tabela
  // grande: contar 3,4 milhões de linhas a cada visita em Ajustes custava
  // 3,4 milhões de "linhas lidas" da cota do Turso — por visita.
  const [{ rows: ref }, { rows: origem }, { rows: porUf }, { rows: ultimas }] = await Promise.all([
    banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'receita_referencia'`),
    banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'receita_origem_arquivos'`),
    banco.execute(
      `SELECT uf, linhas AS total FROM receita_importacoes i
       WHERE status IN ('concluida','parcial') AND linhas > 0
         AND iniciado_em = (SELECT MAX(iniciado_em) FROM receita_importacoes j WHERE j.uf = i.uf AND j.status IN ('concluida','parcial') AND j.linhas > 0)
       ORDER BY uf`,
    ),
    banco.execute(`SELECT * FROM receita_importacoes ORDER BY iniciado_em DESC LIMIT 6`),
  ]);

  return {
    referencia: ref[0] ? String(ref[0].valor) : null,
    origemArquivos: origem[0] ? String(origem[0].valor) : null,
    porUf: porUf.map((r) => ({ uf: String(r.uf), total: Number(r.total) })),
    ultimas: planos<ImportacaoReceita>(ultimas),
  };
}
