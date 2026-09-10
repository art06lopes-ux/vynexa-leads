/**
 * Normalização do nome de cidade e estado vindos do OpenStreetMap.
 *
 * As tags `addr:city` são digitadas por voluntários e chegam sem padrão:
 * numa mesma busca por Contagem apareceram "Belo Horizonte", "Belo
 * Horizonte - MG" e "ribeirão das neves". Sem tratar, o filtro de cidade
 * lista a mesma cidade três vezes e nenhuma das três seleciona tudo.
 *
 * Isto é limpeza de grafia, não invenção de dado: nenhum valor é
 * adivinhado, e o endereço original continua inteiro na coluna
 * `endereco`. O que muda é a caixa das letras e o sufixo de UF que não
 * pertence ao campo cidade.
 */

/** Preposições e artigos ficam minúsculos no meio do nome, como manda o português. */
const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "la", "el"]);

/** Siglas que devem permanecer em caixa alta. */
const SIGLAS = new Set(["mg", "sp", "rj", "df", "rs", "sc", "pr", "ba", "pe", "ce", "go", "es"]);

export function normalizarLocalidade(bruto: string | null | undefined): string | null {
  const texto = bruto?.trim().replace(/\s+/g, " ");
  if (!texto) return null;

  // Remove o sufixo de UF que às vezes vem grudado no nome da cidade:
  // "Belo Horizonte - MG", "Belo Horizonte/MG", "Belo Horizonte (MG)".
  const semUf = texto.replace(/\s*[-/(]\s*[A-Za-z]{2}\s*\)?$/, "").trim();
  const base = semUf === "" ? texto : semUf;

  // Nome já em caixa mista com maiúscula inicial provavelmente está certo;
  // reprocessar só arriscaria estragar grafias como "Governador Valadares".
  // O tratamento vale para os casos claramente irregulares.
  const todoMinusculo = base === base.toLowerCase();
  const todoMaiusculo = base === base.toUpperCase();
  if (!todoMinusculo && !todoMaiusculo) return base;

  return base
    .toLowerCase()
    .split(" ")
    .map((palavra, indice) => {
      if (SIGLAS.has(palavra)) return palavra.toUpperCase();
      // Conector nunca inicia o nome: "Das Flores" existe, "de Minas" não.
      if (indice > 0 && CONECTORES.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}
