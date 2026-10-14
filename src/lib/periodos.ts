/**
 * Períodos do Início (Hoje, 7 dias, 1 mês, 3 meses, 6 meses, 1 ano) e o
 * agrupamento das vendas pagas em pontos de gráfico — com a comparação
 * contra o período anterior do mesmo tamanho. Puro: roda no navegador e
 * nos testes.
 */

export const PERIODOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "1m", rotulo: "1 mês" },
  { chave: "3m", rotulo: "3 meses" },
  { chave: "6m", rotulo: "6 meses" },
  { chave: "1a", rotulo: "1 ano" },
] as const;

export type Periodo = (typeof PERIODOS)[number]["chave"];

export type VendaParaGrafico = { valor: number; custo: number; pagoEm: string };

export type Agrupado = {
  pontos: Array<{ rotulo: string; receita: number; lucro: number }>;
  receita: number;
  lucro: number;
  vendas: number;
  ticket: number;
  /** Variação do lucro contra o período anterior, em %. Nula sem base de comparação. */
  variacaoLucro: number | null;
  variacaoReceita: number | null;
};

const DIA = 86_400_000;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function data(iso: string): Date {
  return new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
}

/** Início do período (e o tamanho, para achar o anterior). */
export function janela(periodo: Periodo, agora = new Date()): { inicio: Date; fim: Date; anteriorInicio: Date } {
  const fim = agora;
  let inicio: Date;
  if (periodo === "hoje") {
    inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === "7d") inicio = new Date(agora.getTime() - 7 * DIA);
  else if (periodo === "1m") inicio = new Date(agora.getTime() - 30 * DIA);
  else if (periodo === "3m") inicio = new Date(agora.getTime() - 91 * DIA);
  else if (periodo === "6m") {
    inicio = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  } else {
    inicio = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
  }
  const tamanho = fim.getTime() - inicio.getTime();
  return { inicio, fim, anteriorInicio: new Date(inicio.getTime() - tamanho) };
}

function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return atual > 0 ? null : 0;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export function agrupar(vendas: VendaParaGrafico[], periodo: Periodo, agora = new Date()): Agrupado {
  const { inicio, fim, anteriorInicio } = janela(periodo, agora);
  const dentro = vendas.filter((v) => {
    const t = data(v.pagoEm).getTime();
    return t >= inicio.getTime() && t <= fim.getTime();
  });
  const anteriores = vendas.filter((v) => {
    const t = data(v.pagoEm).getTime();
    return t >= anteriorInicio.getTime() && t < inicio.getTime();
  });

  // Baldes do gráfico.
  const baldes: Array<{ rotulo: string; de: number; ate: number }> = [];
  if (periodo === "hoje") {
    for (let h = 0; h < 24; h += 1) {
      const de = new Date(inicio);
      de.setHours(h);
      baldes.push({ rotulo: `${String(h).padStart(2, "0")}h`, de: de.getTime(), ate: de.getTime() + 3_600_000 });
    }
  } else if (periodo === "7d" || periodo === "1m") {
    const dias = periodo === "7d" ? 7 : 30;
    for (let i = dias - 1; i >= 0; i -= 1) {
      const d = new Date(agora);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      baldes.push({ rotulo: `${d.getDate()}/${d.getMonth() + 1}`, de: d.getTime(), ate: d.getTime() + DIA });
    }
  } else if (periodo === "3m") {
    for (let i = 12; i >= 0; i -= 1) {
      const fimSemana = agora.getTime() - i * 7 * DIA;
      const de = fimSemana - 7 * DIA;
      const d = new Date(de);
      baldes.push({ rotulo: `${d.getDate()}/${d.getMonth() + 1}`, de, ate: fimSemana });
    }
  } else {
    const meses = periodo === "6m" ? 6 : 12;
    for (let i = meses - 1; i >= 0; i -= 1) {
      const de = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const ate = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
      baldes.push({ rotulo: MESES[de.getMonth()], de: de.getTime(), ate: ate.getTime() });
    }
  }

  const pontos = baldes.map((b) => {
    let receita = 0;
    let lucro = 0;
    for (const v of dentro) {
      const t = data(v.pagoEm).getTime();
      if (t >= b.de && t < b.ate) {
        receita += v.valor;
        lucro += v.valor - v.custo;
      }
    }
    return { rotulo: b.rotulo, receita, lucro };
  });

  const soma = (l: VendaParaGrafico[], lucro: boolean) => l.reduce((t, v) => t + v.valor - (lucro ? v.custo : 0), 0);
  const receita = soma(dentro, false);
  const lucro = soma(dentro, true);
  return {
    pontos,
    receita,
    lucro,
    vendas: dentro.length,
    ticket: dentro.length ? Math.round(receita / dentro.length) : 0,
    variacaoLucro: variacao(lucro, soma(anteriores, true)),
    variacaoReceita: variacao(receita, soma(anteriores, false)),
  };
}
