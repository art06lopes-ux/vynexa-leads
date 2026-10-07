import { simplificar } from "@/services/normalizacao";

/**
 * Todos os países (ISO 3166-1 alpha-2), com nome em português, inglês e
 * espanhol tirado do próprio motor de internacionalização do JavaScript
 * (`Intl.DisplayNames`) — nada de tabela de nomes digitada à mão.
 *
 * Serve à busca global: "Imobiliárias em Portugal", "Dentists in
 * Ireland", "Talleres en Chile" precisam virar código de país.
 */
export const CODIGOS_ISO = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

/** Apelidos que o Intl não devolve, mas que as pessoas escrevem. */
const APELIDOS: Record<string, string> = {
  eua: "US",
  usa: "US",
  "estados unidos": "US",
  "united states": "US",
  america: "US",
  uk: "GB",
  inglaterra: "GB",
  england: "GB",
  escocia: "GB",
  scotland: "GB",
  holanda: "NL",
  emirados: "AE",
  dubai: "AE",
};

let indice: Map<string, string> | null = null;

function montarIndice(): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const idioma of ["pt-BR", "pt-PT", "en", "es", "fr", "de"]) {
    let nomes: Intl.DisplayNames;
    try {
      nomes = new Intl.DisplayNames([idioma], { type: "region" });
    } catch {
      continue;
    }
    for (const codigo of CODIGOS_ISO) {
      const nome = nomes.of(codigo);
      if (nome && nome !== codigo) mapa.set(simplificar(nome), codigo);
    }
  }
  for (const [apelido, codigo] of Object.entries(APELIDOS)) mapa.set(apelido, codigo);
  return mapa;
}

/** Código ISO a partir do nome do país em pt/en/es/fr/de, ou nulo. */
export function codigoDoPaisPorNome(nome: string): string | null {
  indice ??= montarIndice();
  return indice.get(simplificar(nome)) ?? null;
}

/** Nome do país em português para qualquer código ISO. */
export function nomePaisPt(codigo: string): string {
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(codigo.toUpperCase()) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Idioma provável da abordagem a partir do país (fallback: inglês). */
export function idiomaProvavel(codigo: string): string {
  const c = codigo.toUpperCase();
  if (c === "BR") return "pt-BR";
  if (["PT", "AO", "MZ", "CV", "GW", "ST", "TL"].includes(c)) return "pt-PT";
  if (["ES", "MX", "AR", "CL", "CO", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "GT", "HN", "SV", "NI", "DO", "CU", "PR"].includes(c)) return "es";
  if (["FR", "BE", "LU", "MC", "SN", "CI"].includes(c)) return "fr";
  if (["DE", "AT", "CH", "LI"].includes(c)) return "de";
  if (c === "IT" || c === "SM") return "it";
  return "en";
}

/**
 * Estados e regiões frequentes que alguém escreve sem o país —
 * "Auto detailing em California". Só os casos sem ambiguidade.
 */
const REGIOES: Record<string, string> = {
  california: "US", florida: "US", texas: "US", "new york": "US", "nova york": "US", nevada: "US",
  arizona: "US", georgia: "US", illinois: "US", washington: "US", massachusetts: "US", colorado: "US",
  miami: "US", orlando: "US", "los angeles": "US", "san diego": "US", houston: "US", dallas: "US",
  chicago: "US", boston: "US", "las vegas": "US", atlanta: "US", seattle: "US", austin: "US",
  toronto: "CA", vancouver: "CA", montreal: "CA", ontario: "CA", quebec: "CA",
  london: "GB", londres: "GB", dublin: "IE", sydney: "AU", melbourne: "AU",
  lisboa: "PT", porto: "PT", braga: "PT", faro: "PT", coimbra: "PT",
  madrid: "ES", barcelona: "ES", paris: "FR", berlin: "DE", berlim: "DE",
  amazonas: "BR", manaus: "BR", manacapuru: "BR", "sao paulo": "BR", "rio de janeiro": "BR",
  "belo horizonte": "BR", curitiba: "BR", "porto alegre": "BR", salvador: "BR", fortaleza: "BR",
  recife: "BR", brasilia: "BR", belem: "BR", goiania: "BR", florianopolis: "BR", umuarama: "BR",
  parana: "BR", "minas gerais": "BR", bahia: "BR", "santa catarina": "BR", "rio grande do sul": "BR",
};

/** País implícito em nomes de cidades/estados conhecidos, ou nulo. */
export function paisDaRegiao(texto: string): string | null {
  const t = simplificar(texto);
  for (const [regiao, pais] of Object.entries(REGIOES)) {
    if (t === regiao || t.startsWith(`${regiao} `) || t.endsWith(` ${regiao}`)) return pais;
  }
  return null;
}
