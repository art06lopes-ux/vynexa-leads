/**
 * Conversão e formatação de dinheiro.
 *
 * Separado de `stripe.ts` porque o formulário e o gráfico rodam no
 * navegador, e aquele módulo usa `Buffer` — que não existe lá.
 */

/** Converte "1.297,00", "1297" ou "R$ 1.297" em centavos, sem ponto flutuante. */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/[^\d.,]/g, "");
  if (limpo === "") return null;

  // O último separador é o decimal: "1.297,00" e "1,297.00" significam a
  // mesma coisa em locais diferentes.
  const corte = Math.max(limpo.lastIndexOf("."), limpo.lastIndexOf(","));

  const inteiro = (corte === -1 ? limpo : limpo.slice(0, corte)).replace(/\D/g, "");
  const decimal = corte === -1 ? "" : limpo.slice(corte + 1).replace(/\D/g, "");

  if (inteiro === "" && decimal === "") return null;

  // Mais de dois dígitos depois do separador significa que ele era de
  // milhar, não decimal: "1.297" são 1297 reais, não 1 real e 297.
  if (decimal.length > 2) return Number(`${inteiro}${decimal}`) * 100;

  return Number(inteiro || "0") * 100 + Number(decimal.padEnd(2, "0") || "0");
}

export function formatarDinheiro(centavos: number, moeda = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(
    centavos / 100,
  );
}
