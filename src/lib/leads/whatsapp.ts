import { ddiDoPais } from "@/lib/geo/paises";

/**
 * Normalização de telefone para o formato que o wa.me aceita: dígitos
 * puros, com código do país, sem o sinal de mais.
 *
 * A fonte é texto livre — o OSM traz "+55 31 99999-8888", "(31)
 * 3333-2222" e "031 99999 8888" na mesma tag —, então a entrada precisa
 * ser tolerante. A saída, rígida.
 *
 * O parâmetro `pais` NÃO é opcional por acidente. A primeira versão
 * assumia Brasil sempre, e um telefone americano "+1 407 555 0134"
 * virava "5514075550134": o "+" era descartado, sobravam 11 dígitos, o
 * "14" passava por DDD de Campinas e o número ganhava um 55 na frente.
 * O resultado era um link de WhatsApp para um número brasileiro
 * aleatório. Com a busca internacional isso deixou de ser hipótese.
 */

/** DDDs válidos no Brasil. Impede tratar "5511…" como DDD 55. */
const DDDS_BRASIL = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Faixa da E.164: 8 dígitos é o menor número internacional plausível; 15 é o teto do padrão. */
const MIN_E164 = 8;
const MAX_E164 = 15;

/**
 * Devolve o número pronto para o wa.me, ou nulo quando não dá para
 * afirmar que está correto.
 *
 * Nulo não é falha: é a resposta honesta para um número que não pode ser
 * discado de fora da cidade. A interface pede o preenchimento manual, em
 * vez de gerar um link que abre conversa com quem não é o lead — que é
 * exatamente o tipo de dado inventado que o projeto proíbe.
 */
export function normalizarTelefone(
  bruto: string | null | undefined,
  pais: string = "BR",
): string | null {
  const texto = bruto?.trim();
  if (!texto) return null;

  // A tag do OSM às vezes traz vários números separados por ";" ou ",".
  // O primeiro é o principal, por convenção.
  const primeiro = (texto.split(/[;,/]/)[0] ?? texto).trim();

  const digitos = primeiro.replace(/\D/g, "");
  if (digitos === "") return null;

  // 0800 e 0300 não existem no WhatsApp.
  if (digitos.startsWith("0800") || digitos.startsWith("0300")) return null;

  // Já veio em formato internacional. É a informação mais confiável que
  // existe aqui: quem escreveu o "+" declarou o código do país.
  if (primeiro.startsWith("+")) {
    return digitos.length >= MIN_E164 && digitos.length <= MAX_E164 ? digitos : null;
  }

  const codigo = pais.toUpperCase();
  return codigo === "BR" ? normalizarBrasil(digitos) : normalizarInternacional(digitos, codigo);
}

function normalizarBrasil(entrada: string): string | null {
  let digitos = entrada;

  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    // Veio com o código do país, mas só confia se o que sobra é DDD de
    // verdade — senão "5541…" poderia ser um fixo de Curitiba sem DDI.
    if (DDDS_BRASIL.has(Number(digitos.slice(2, 4)))) return digitos;
  }

  // "031 99999-8888": o zero é prefixo de operadora, não faz parte do DDD.
  if ((digitos.length === 11 || digitos.length === 12) && digitos.startsWith("0")) {
    digitos = digitos.slice(1);
  }

  if (digitos.length === 10 || digitos.length === 11) {
    if (DDDS_BRASIL.has(Number(digitos.slice(0, 2)))) return `55${digitos}`;
  }

  // 8 ou 9 dígitos: número local sem DDD. Não dá para adivinhar a cidade.
  return null;
}

/**
 * Fora do Brasil, só aceita número que já carregue o código do país.
 *
 * Poderia prefixar o DDI de qualquer número local, mas isso seria um
 * palpite: cada país tem seu plano de numeração, com prefixo nacional
 * ("0" no Reino Unido, na Alemanha, na França) que precisa cair antes.
 * Errar aqui produz um link para outra pessoa, e é melhor pedir o número
 * ao operador do que entregar um telefone inventado.
 */
function normalizarInternacional(digitos: string, pais: string): string | null {
  const ddi = ddiDoPais(pais);
  if (ddi === null) return null;

  if (!digitos.startsWith(ddi)) return null;
  if (digitos.length <= ddi.length) return null;

  return digitos.length >= MIN_E164 && digitos.length <= MAX_E164 ? digitos : null;
}

/**
 * Formata para leitura humana.
 *
 * Só o Brasil ganha máscara — "(31) 99999-8888" é o formato que o
 * operador reconhece. Para os outros países, devolve o que a fonte
 * trouxe: inventar uma máscara estrangeira deixaria o número mais
 * difícil de conferir, não mais fácil.
 */
export function formatarTelefone(
  bruto: string | null | undefined,
  pais: string = "BR",
): string | null {
  const original = bruto?.trim() || null;
  if (pais.toUpperCase() !== "BR") return original;

  const normalizado = normalizarTelefone(bruto, "BR");
  if (normalizado === null || !normalizado.startsWith("55")) return original;

  const nacional = normalizado.slice(2);
  if (nacional.length !== 10 && nacional.length !== 11) return original;

  const ddd = nacional.slice(0, 2);
  const resto = nacional.slice(2);
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * Substitui os placeholders do template.
 *
 * São dois, de propósito: cada placeholder novo é mais uma chance de a
 * mensagem sair com "{campo}" cru para um cliente real.
 */
export function preencherTemplate(
  texto: string,
  dados: { nomeEmpresa: string; nicho: string },
): string {
  return texto.replaceAll("{nome_empresa}", dados.nomeEmpresa).replaceAll("{nicho}", dados.nicho);
}

/**
 * Monta o link do WhatsApp, ou nulo quando o telefone não é utilizável.
 *
 * `encodeURIComponent` e não `URLSearchParams`: este último codifica
 * espaço como "+", que o WhatsApp mostra literalmente no meio do texto.
 */
export function montarLinkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string,
  pais: string = "BR",
): string | null {
  const numero = normalizarTelefone(telefone, pais);
  if (numero === null) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** Link para o elemento no OpenStreetMap, a partir do "node/123456". */
export function montarLinkOsm(osmId: string): string {
  return `https://www.openstreetmap.org/${osmId}`;
}
