/**
 * Distritos de Portugal e as duas regiões autónomas.
 *
 * Sem API pública tão pronta quanto o IBGE para os municípios (INE exige
 * cadastro), então a lista para por aqui — o distrito já dá ao Nominatim
 * uma área certa para geocodificar, o que a busca livre por texto não
 * garantia. Cidade continua texto livre.
 */

export type Distrito = { nome: string };

export const DISTRITOS_PT: readonly Distrito[] = [
  { nome: "Aveiro" },
  { nome: "Beja" },
  { nome: "Braga" },
  { nome: "Bragança" },
  { nome: "Castelo Branco" },
  { nome: "Coimbra" },
  { nome: "Évora" },
  { nome: "Faro" },
  { nome: "Guarda" },
  { nome: "Leiria" },
  { nome: "Lisboa" },
  { nome: "Portalegre" },
  { nome: "Porto" },
  { nome: "Santarém" },
  { nome: "Setúbal" },
  { nome: "Viana do Castelo" },
  { nome: "Vila Real" },
  { nome: "Viseu" },
  { nome: "Região Autónoma dos Açores" },
  { nome: "Região Autónoma da Madeira" },
] as const;
