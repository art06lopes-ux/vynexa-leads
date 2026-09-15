import "server-only";

import { getBanco, planos } from "@/db/cliente";

export type ImportacaoReceita = {
  id: string;
  referencia: string;
  uf: string;
  linhas: number;
  status: "em_andamento" | "concluida" | "erro";
  erro: string | null;
  iniciado_em: string;
  concluido_em: string | null;
};

export type ResumoReceita = {
  /** Pasta da Receita da última importação concluída, ex.: 2026-09. */
  referencia: string | null;
  /** Estabelecimentos ativos na base, por estado. */
  porUf: Array<{ uf: string; total: number }>;
  ultimas: ImportacaoReceita[];
};

export async function resumoReceita(): Promise<ResumoReceita> {
  const banco = getBanco();
  const [{ rows: ref }, { rows: porUf }, { rows: ultimas }] = await Promise.all([
    banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'receita_referencia'`),
    banco.execute(`SELECT uf, COUNT(*) AS total FROM receita_estabelecimentos GROUP BY uf ORDER BY uf`),
    banco.execute(`SELECT * FROM receita_importacoes ORDER BY iniciado_em DESC LIMIT 6`),
  ]);

  return {
    referencia: ref[0] ? String(ref[0].valor) : null,
    porUf: porUf.map((r) => ({ uf: String(r.uf), total: Number(r.total) })),
    ultimas: planos<ImportacaoReceita>(ultimas),
  };
}
