/**
 * Países atendidos e o idioma da abordagem.
 *
 * Lista curada, não a ISO 3166 inteira: são os mercados onde a Vynexa
 * pode efetivamente vender, e uma lista de 249 países só tornaria o
 * seletor pior. Acrescentar um país é acrescentar uma linha aqui.
 *
 * `idioma` alimenta `empresas.idioma_abordagem` e, na Etapa 2, decide em
 * que língua o Gemini escreve a mensagem. Os cinco valores possíveis são
 * os que o modelo cobre bem: pt-BR, en, es, fr, de.
 */

export type Pais = {
  /** ISO 3166-1 alpha-2, maiúsculo. */
  codigo: string;
  nome: string;
  idioma: "pt-BR" | "en" | "es" | "fr" | "de";
  /** Código de discagem internacional, sem o "+". */
  ddi: string;
};

export const PAISES: readonly Pais[] = [
  { codigo: "BR", nome: "Brasil", idioma: "pt-BR", ddi: "55" },
  { codigo: "PT", nome: "Portugal", idioma: "pt-BR", ddi: "351" },

  { codigo: "US", nome: "Estados Unidos", idioma: "en", ddi: "1" },
  { codigo: "CA", nome: "Canadá", idioma: "en", ddi: "1" },
  { codigo: "GB", nome: "Reino Unido", idioma: "en", ddi: "44" },
  { codigo: "IE", nome: "Irlanda", idioma: "en", ddi: "353" },
  { codigo: "AU", nome: "Austrália", idioma: "en", ddi: "61" },
  { codigo: "NZ", nome: "Nova Zelândia", idioma: "en", ddi: "64" },
  { codigo: "ZA", nome: "África do Sul", idioma: "en", ddi: "27" },

  { codigo: "ES", nome: "Espanha", idioma: "es", ddi: "34" },
  { codigo: "MX", nome: "México", idioma: "es", ddi: "52" },
  { codigo: "AR", nome: "Argentina", idioma: "es", ddi: "54" },
  { codigo: "CL", nome: "Chile", idioma: "es", ddi: "56" },
  { codigo: "CO", nome: "Colômbia", idioma: "es", ddi: "57" },
  { codigo: "PE", nome: "Peru", idioma: "es", ddi: "51" },
  { codigo: "UY", nome: "Uruguai", idioma: "es", ddi: "598" },
  { codigo: "PY", nome: "Paraguai", idioma: "es", ddi: "595" },
  { codigo: "CR", nome: "Costa Rica", idioma: "es", ddi: "506" },
  { codigo: "PA", nome: "Panamá", idioma: "es", ddi: "507" },

  { codigo: "FR", nome: "França", idioma: "fr", ddi: "33" },
  { codigo: "BE", nome: "Bélgica", idioma: "fr", ddi: "32" },
  { codigo: "LU", nome: "Luxemburgo", idioma: "fr", ddi: "352" },

  { codigo: "DE", nome: "Alemanha", idioma: "de", ddi: "49" },
  { codigo: "AT", nome: "Áustria", idioma: "de", ddi: "43" },
  { codigo: "CH", nome: "Suíça", idioma: "de", ddi: "41" },
] as const;

const PorCodigo = new Map(PAISES.map((p) => [p.codigo, p]));

export function acharPais(codigo: string): Pais | undefined {
  return PorCodigo.get(codigo.toUpperCase());
}

export function nomeDoPais(codigo: string): string {
  return PorCodigo.get(codigo.toUpperCase())?.nome ?? codigo.toUpperCase();
}

/** Código de discagem do país. Nulo quando o país não está na lista. */
export function ddiDoPais(codigo: string): string | null {
  return PorCodigo.get(codigo.toUpperCase())?.ddi ?? null;
}

/**
 * Idioma da abordagem a partir do país.
 *
 * Cai em inglês, e não em português, quando o país é desconhecido: um
 * e-mail em inglês para quem fala outra língua é compreendido; um em
 * português quase nunca é.
 */
export function idiomaDoPais(codigo: string): Pais["idioma"] {
  return PorCodigo.get(codigo.toUpperCase())?.idioma ?? "en";
}
