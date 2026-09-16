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

/**
 * Abre WhatsApp? Número discável e, no Brasil, celular. É o que alimenta
 * a coluna `empresas.whatsapp`, o filtro "Canal" e o contador do painel.
 */
export function abreWhatsapp(telefone: string | null | undefined, pais: string): 0 | 1 {
  const n = normalizarTelefone(telefone, pais);
  if (n === null) return 0;
  if (pais.toUpperCase() === "BR" && !ehCelularBrasil(telefone)) return 0;
  return 1;
}

/**
 * Celular brasileiro: depois do DDD, nove dígitos começando em 9 — ou
 * oito começando em 6 a 9 (número anterior ao nono dígito). Fixo começa
 * em 2 a 5. É o que decide se o número abre WhatsApp ou só chamada.
 */
export function ehCelularBrasil(bruto: string | null | undefined): boolean {
  const normalizado = normalizarTelefone(bruto, "BR");
  if (!normalizado) return false;
  const local = normalizado.slice(4);
  return local.length === 9 && local.startsWith("9");
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
    if (!DDDS_BRASIL.has(Number(digitos.slice(0, 2)))) return null;
    // Celular com 8 dígitos é número anterior ao nono dígito, que a
    // Anatel acrescentou a todo celular do país entre 2012 e 2016 — a
    // regra é fixa: "9" na frente dos que começavam em 6, 7, 8 ou 9. A
    // base da Receita guarda muitos telefones do cadastro original,
    // ainda sem ele. Aplicar a regra é conversão, não adivinhação; fixo
    // (começa em 2 a 5) fica como está.
    if (digitos.length === 10 && /[6-9]/.test(digitos.charAt(2))) {
      return `55${digitos.slice(0, 2)}9${digitos.slice(2)}`;
    }
    return `55${digitos}`;
  }

  // 8 ou 9 dígitos: número local sem DDD. Não dá para adivinhar a cidade.
  return null;
}

/**
 * Plano de numeração de cada país atendido: o prefixo de tronco que se
 * disca dentro do país e cai na chamada internacional ("0" na Europa,
 * "1" na América do Norte), e os tamanhos válidos do número nacional
 * depois de tirá-lo.
 *
 * É regra publicada pelo regulador de cada país (ITU-T E.164 e os
 * planos nacionais), não palpite: "020 7946 0000" em Londres é, por
 * definição, +44 20 7946 0000. País fora desta tabela continua exigindo
 * o número já em formato internacional — a Argentina é o caso: o
 * celular ganha um "9" depois do DDI e perde o "15" da discagem local,
 * e errar isso manda a mensagem para outra pessoa.
 */
const PLANOS: Record<string, { tronco: string; tamanhos: number[] }> = {
  US: { tronco: "1", tamanhos: [10] },
  CA: { tronco: "1", tamanhos: [10] },
  GB: { tronco: "0", tamanhos: [10] },
  IE: { tronco: "0", tamanhos: [9] },
  AU: { tronco: "0", tamanhos: [9] },
  NZ: { tronco: "0", tamanhos: [8, 9] },
  ZA: { tronco: "0", tamanhos: [9] },
  PT: { tronco: "", tamanhos: [9] },
  ES: { tronco: "", tamanhos: [9] },
  MX: { tronco: "", tamanhos: [10] },
  CL: { tronco: "", tamanhos: [9] },
  CO: { tronco: "", tamanhos: [10] },
  PE: { tronco: "", tamanhos: [9] },
  UY: { tronco: "0", tamanhos: [8] },
  PY: { tronco: "0", tamanhos: [9] },
  CR: { tronco: "", tamanhos: [8] },
  PA: { tronco: "", tamanhos: [8] },
  FR: { tronco: "0", tamanhos: [9] },
  BE: { tronco: "0", tamanhos: [8, 9] },
  LU: { tronco: "", tamanhos: [8, 9] },
  DE: { tronco: "0", tamanhos: [9, 10, 11] },
  AT: { tronco: "0", tamanhos: [9, 10, 11, 12] },
  CH: { tronco: "0", tamanhos: [9] },
};

/**
 * Fora do Brasil: aceita o número já com DDI, ou um número nacional que
 * bata com o plano de numeração do país da busca — aí o DDI é
 * acrescentado e o tronco cai. Fora dessas duas formas, nulo: melhor
 * pedir o número ao operador do que entregar um link errado.
 */
function normalizarInternacional(digitos: string, pais: string): string | null {
  const ddi = ddiDoPais(pais);
  if (ddi === null) return null;

  const plano = PLANOS[pais];

  // Já veio com o código do país? Só quando o que sobra tem tamanho de
  // número nacional — senão "1" + 10 dígitos de um londrino que começa
  // com 1 viraria número americano.
  if (digitos.startsWith(ddi) && digitos.length > ddi.length) {
    const nacional = digitos.slice(ddi.length);
    const tamanhoOk = plano ? plano.tamanhos.includes(nacional.length) : true;
    if (tamanhoOk && digitos.length >= MIN_E164 && digitos.length <= MAX_E164) return digitos;
  }

  if (!plano) return null;

  const semTronco =
    plano.tronco !== "" && digitos.startsWith(plano.tronco) && plano.tamanhos.includes(digitos.length - plano.tronco.length)
      ? digitos.slice(plano.tronco.length)
      : digitos;

  if (!plano.tamanhos.includes(semTronco.length)) return null;
  return `${ddi}${semTronco}`;
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
