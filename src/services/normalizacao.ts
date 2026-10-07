import { ehRedeSocial, extrairDominio } from "@/lib/leads/classificacao";
import { normalizarTelefone } from "@/lib/leads/whatsapp";

/**
 * Chaves de comparação para o dedup.
 *
 * Duas fontes escrevem a mesma empresa de jeitos diferentes: o Google diz
 * "Barbearia do Zé LTDA", a Receita "BARBEARIA DO ZE", o OSM "Barbearia
 * do Zé". As chaves abaixo tiram o que não distingue uma empresa de outra
 * — acento, caixa, pontuação, sufixo societário — e sobra o que distingue.
 */

/** Minúsculas, sem acento, só letras, números e espaço simples. */
export function simplificar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Sufixos societários e de tipo que não fazem parte do nome. */
const SUFIXOS = /\b(ltda|me|epp|eireli|mei|s a|sa|inc|llc|ltd|co|corp|gmbh|lda|unipessoal|sociedade limitada)\b/g;

export function chaveNome(nome: string | null | undefined): string | null {
  const chave = simplificar(nome).replace(SUFIXOS, " ").replace(/\s+/g, " ").trim();
  return chave === "" ? null : chave;
}

/** Abreviações de logradouro, para "R. Sete" e "Rua Sete" casarem. */
const LOGRADOURO: Array<[RegExp, string]> = [
  [/\b(r|rua)\b/g, "rua"],
  [/\b(av|avda|avenida|ave|avenue)\b/g, "av"],
  [/\b(tv|trav|travessa)\b/g, "tv"],
  [/\b(al|alameda)\b/g, "al"],
  [/\b(pc|praca)\b/g, "pc"],
  [/\b(rod|rodovia)\b/g, "rod"],
  [/\b(est|estrada)\b/g, "est"],
  [/\b(st|street)\b/g, "st"],
  [/\b(rd|road)\b/g, "rd"],
  [/\b(n|no|nro|numero)\b/g, ""],
];

/**
 * Endereço normalizado: só o logradouro e o número, que é o que identifica
 * o ponto. Bairro, cidade, CEP e país ficam de fora — cada fonte escreve
 * de um jeito, e a cidade já entra no dedup por coluna própria.
 */
export function chaveEndereco(endereco: string | null | undefined): string | null {
  const primeiro = (endereco ?? "").split(/[,\-–]/).slice(0, 2).join(" ");
  let chave = simplificar(primeiro);
  for (const [padrao, troca] of LOGRADOURO) chave = chave.replace(padrao, troca);
  chave = chave.replace(/\s+/g, " ").trim();
  // Um endereço sem número ("Centro") não identifica nada: nulo, para não
  // fundir duas empresas que só compartilham o bairro.
  if (chave === "" || !/\d/.test(chave)) return null;
  return chave;
}

/**
 * Domínio do site PRÓPRIO. Instagram, Linktree, Wix grátis e afins não
 * contam: duas empresas podem ter perfil no mesmo instagram.com.
 */
export function dominioProprio(website: string | null | undefined): string | null {
  if (!website || ehRedeSocial(website)) return null;
  return extrairDominio(website);
}

/** Telefone em E.164 (só dígitos), ou nulo se não der para afirmar. */
export function telefoneE164(telefone: string | null | undefined, pais: string): string | null {
  return normalizarTelefone(telefone, pais);
}

/** E-mail em minúsculas, ou nulo se não tiver cara de e-mail. */
export function normalizarEmail(email: string | null | undefined): string | null {
  const limpo = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo) ? limpo : null;
}
