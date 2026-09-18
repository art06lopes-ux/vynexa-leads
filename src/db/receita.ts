import "server-only";

import { getBanco, planos } from "@/db/cliente";
import { CNAES_POR_SEGMENTO } from "@/lib/receita/cnaes";
import { chaveDeMunicipio } from "@/lib/receita/texto";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";

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

export type NichoRegiao = {
  slug: string;
  rotulo: string;
  /** Estabelecimentos ativos da Receita nessa região, nos CNAEs do segmento. */
  total: number;
  /**
   * Participação do segmento no total de estabelecimentos mapeados na
   * região, arredondada — não é chance de venda, é proporção real.
   */
  participacao: number;
};

/**
 * Ranking de segmentos por quantidade de estabelecimentos da Receita na
 * região — sem cidade, o estado inteiro.
 *
 * É uma aproximação, não uma previsão de venda: mais estabelecimentos
 * ativos é mais chance de achar quem não tem site, que é a maioria (a
 * ferramenta inteira parte disso). Não depende de IA nem de histórico
 * de caçadas — só contagem, então funciona até numa região nunca buscada.
 */
export async function nichosPorRegiao(uf: string, cidade: string | null): Promise<NichoRegiao[]> {
  const municipio = cidade ? chaveDeMunicipio(cidade) : null;
  const todosCnaes = [...new Set(Object.values(CNAES_POR_SEGMENTO).flat())];
  const banco = getBanco();

  // 100 é o teto de parâmetros por statement no D1, e a lista de CNAEs
  // de todos os segmentos passa disso — daí o lote, com espaço reservado
  // para `uf` e `municipio` no mesmo statement.
  const totalPorCnae = new Map<string, number>();
  for (let i = 0; i < todosCnaes.length; i += 90) {
    const lote = todosCnaes.slice(i, i + 90);
    const { rows } = await banco.execute({
      sql: `SELECT cnae, COUNT(*) AS total FROM receita_estabelecimentos
            WHERE uf = ? ${municipio ? "AND municipio = ?" : ""} AND cnae IN (${lote.map(() => "?").join(",")})
            GROUP BY cnae`,
      args: [uf.toUpperCase(), ...(municipio ? [municipio] : []), ...lote],
    });
    for (const r of rows) totalPorCnae.set(String(r.cnae), Number(r.total));
  }
  // Denominador da participação: soma de todos os CNAEs mapeados na
  // região. Alguns poucos CNAEs pertencem a dois segmentos (ex.: 4321500
  // está em "construção" e "energia solar" — a mesma empresa pode
  // aparecer nas duas caçadas, como já documentado ali), então a soma das
  // participações pode passar de 100%. É esperado, não é erro.
  const totalGeral = Array.from(totalPorCnae.values()).reduce((a, b) => a + b, 0);

  const porSegmento = Object.entries(CNAES_POR_SEGMENTO)
    .map(([slug, cnaes]) => {
      const total = cnaes.reduce((soma, c) => soma + (totalPorCnae.get(c) ?? 0), 0);
      return {
        slug,
        rotulo: rotuloDoSegmento(slug),
        total,
        participacao: totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0,
      };
    })
    .filter((n) => n.total > 0)
    .sort((a, b) => b.total - a.total);

  return porSegmento;
}
