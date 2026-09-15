/**
 * Normalização de texto para casar registros da Receita com os do OSM.
 *
 * A Receita escreve tudo em caixa alta sem acento ("BARBEARIA DO ZE
 * LTDA"); o OSM em caixa mista com acento ("Barbearia do Zé"). Para
 * comparar, os dois lados passam pela mesma régua: sem acento, sem
 * pontuação, sem sufixo societário, espaços únicos, caixa alta.
 *
 * É comparação, não invenção: o nome gravado continua sendo o original
 * de cada fonte.
 */

const SUFIXOS = /\b(LTDA|ME|EPP|EIRELI|S\/?A|MEI|LTDA\.|-ME|-EPP)\b/g;

export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function chaveDeNome(nome: string): string {
  return semAcento(nome)
    .toUpperCase()
    .replace(SUFIXOS, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Município como a Receita grava: caixa alta, sem acento, espaços únicos. */
export function chaveDeMunicipio(nome: string): string {
  return semAcento(nome).toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Razão social de MEI vem como "NOME DA PESSOA 12345678901" — o CPF
 * colado no fim. Sai o número; o nome fica, porque é o que a Receita
 * registra como a empresa.
 */
export function limparRazaoSocial(razao: string): string {
  return razao.replace(/\s+\d{11}\s*$/, "").replace(/\s+/g, " ").trim();
}

/** Primeira letra maiúscula em cada palavra, conectores minúsculos. */
const CONECTORES = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "EM", "COM"]);
export function caixaMista(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .map((p, i) => {
      const alta = p.toUpperCase();
      if (i > 0 && CONECTORES.has(alta)) return p;
      // Siglas curtas ficam como estão: "JR", "MG".
      if (p.length <= 2 && i > 0) return alta;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}
