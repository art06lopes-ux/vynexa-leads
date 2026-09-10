/**
 * Geração de CSV.
 *
 * Escrito à mão em vez de biblioteca: são vinte linhas e a regra de
 * escape do RFC 4180 é uma só. Uma dependência aqui custaria mais do
 * que resolve.
 */

/**
 * Escapa um campo.
 *
 * Aspas viram aspas duplas, e o campo inteiro é envolvido quando contém
 * separador, aspas ou quebra de linha. O nome de uma empresa com vírgula
 * — "Bar do Zé, Ltda" — quebraria a planilha sem isto.
 */
function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);

  // Um campo que começa com =, +, - ou @ é interpretado como fórmula
  // pelo Excel e pelo Google Sheets. Um nome de empresa começando com
  // "+" viraria execução de fórmula ao abrir o arquivo; a aspa simples
  // à frente neutraliza sem alterar o que se lê na célula.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;

  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function gerarCsv(cabecalhos: string[], linhas: unknown[][]): string {
  const corpo = [cabecalhos, ...linhas].map((linha) => linha.map(escapar).join(",")).join("\r\n");

  // BOM UTF-8: sem ele, o Excel no Windows abre o arquivo em ANSI e todo
  // acento vira caractere quebrado. É o formato que o operador usa.
  return `﻿${corpo}\r\n`;
}
