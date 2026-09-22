/**
 * Estados/províncias dos poucos países onde a busca sem essa informação
 * falha na certa — EUA, Canadá e Austrália são grandes demais para a
 * Overpass cobrir de uma vez (ver `RAIO_MAXIMO_PAIS_INTEIRO_KM` em
 * `src/worker/handlers/busca.ts`). Uma lista fechada evita o operador
 * digitar algo que o Nominatim não acha (já aconteceu: "Califoria") e
 * deixa claro que preencher isto aqui é preciso, não opcional.
 *
 * Sem API pública e gratuita equivalente ao IBGE para todo país, então a
 * lista fica só nestes três. Os demais continuam texto livre.
 */

export const ESTADOS_US: readonly string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
];

export const PROVINCIAS_CA: readonly string[] = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
  "Northwest Territories", "Nunavut", "Yukon",
];

export const ESTADOS_AU: readonly string[] = [
  "New South Wales", "Victoria", "Queensland", "Western Australia",
  "South Australia", "Tasmania", "Australian Capital Territory",
  "Northern Territory",
];

/** Lista de regiões para o país, ou nulo quando o campo continua texto livre. */
export function regioesDoPais(pais: string): readonly string[] | null {
  switch (pais) {
    case "US": return ESTADOS_US;
    case "CA": return PROVINCIAS_CA;
    case "AU": return ESTADOS_AU;
    default: return null;
  }
}
