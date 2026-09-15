/**
 * Períodos e tipos compartilhados entre servidor e cliente.
 *
 * Vivem fora de `src/db/vendas.ts` porque aquele módulo é `server-only`:
 * o seletor de período e o gráfico rodam no navegador, e importar de lá
 * quebra o build na fronteira de componentes.
 */

export const PERIODOS = {
  hoje: { rotulo: "Hoje", dias: 1 },
  "7d": { rotulo: "7 dias", dias: 7 },
  "30d": { rotulo: "30 dias", dias: 30 },
  "3m": { rotulo: "3 meses", dias: 90 },
  "1a": { rotulo: "1 ano", dias: 365 },
} as const;

export type ChavePeriodo = keyof typeof PERIODOS;

export function ehPeriodo(valor: string | undefined): valor is ChavePeriodo {
  return valor !== undefined && valor in PERIODOS;
}

export type PontoReceita = { dia: string; valor: number };
