/**
 * Tradução dos segmentos comerciais da Vynexa para as tags do OpenStreetMap.
 *
 * Um segmento comercial quase nunca é uma tag só. "Pet shop" no Brasil
 * cobre loja de ração, banho e tosa e clínica veterinária, que no OSM são
 * três tags distintas. Por isso cada segmento carrega uma LISTA de
 * filtros, e cada filtro é uma conjunção de tags — a busca é a união.
 *
 * Referência: https://wiki.openstreetmap.org/wiki/Map_features
 */

export type TagOsm = {
  chave: string;
  valor: string;
  /** Compara com `~` (regex) em vez de `=`. Para tags multivaloradas. */
  regex?: boolean;
};

/** Conjunção: o elemento precisa ter TODAS estas tags. */
export type FiltroOsm = { tags: TagOsm[] };

export type Segmento = {
  slug: string;
  rotulo: string;
  /** Rótulo em inglês, usado quando a busca é internacional. */
  rotuloEn: string;
  filtros: FiltroOsm[];
};

export const SEGMENTOS: readonly Segmento[] = [
  {
    slug: "barbearia",
    rotulo: "Barbearia e cabeleireiro",
    rotuloEn: "Barbershop & hair salon",
    filtros: [{ tags: [{ chave: "shop", valor: "hairdresser" }] }],
  },
  {
    slug: "estetica",
    rotulo: "Estética e beleza",
    rotuloEn: "Beauty & aesthetics",
    filtros: [
      { tags: [{ chave: "shop", valor: "beauty" }] },
      { tags: [{ chave: "shop", valor: "massage" }] },
      { tags: [{ chave: "leisure", valor: "spa" }] },
    ],
  },
  {
    slug: "estetica_automotiva",
    rotulo: "Estética automotiva",
    rotuloEn: "Auto detailing & car wash",
    // O OSM não tem tag própria para detalhamento automotivo.
    // `amenity=car_wash` é onde lava-jato e estética automotiva acabam
    // mapeados, e é o filtro mais próximo sem arrastar oficina junto.
    filtros: [{ tags: [{ chave: "amenity", valor: "car_wash" }] }],
  },
  {
    slug: "clinica",
    rotulo: "Clínicas e consultórios",
    rotuloEn: "Clinics & medical offices",
    filtros: [
      { tags: [{ chave: "amenity", valor: "clinic" }] },
      { tags: [{ chave: "amenity", valor: "doctors" }] },
      { tags: [{ chave: "amenity", valor: "dentist" }] },
      { tags: [{ chave: "healthcare", valor: "physiotherapist" }] },
    ],
  },
  {
    slug: "restaurante",
    rotulo: "Restaurantes e cafés",
    rotuloEn: "Restaurants & cafés",
    filtros: [
      { tags: [{ chave: "amenity", valor: "restaurant" }] },
      { tags: [{ chave: "amenity", valor: "cafe" }] },
      { tags: [{ chave: "amenity", valor: "fast_food" }] },
    ],
  },
  {
    slug: "academia",
    rotulo: "Academias",
    rotuloEn: "Gyms & fitness",
    filtros: [
      { tags: [{ chave: "leisure", valor: "fitness_centre" }] },
      { tags: [{ chave: "leisure", valor: "sports_centre" }] },
    ],
  },
  {
    slug: "petshop",
    rotulo: "Pet shops e veterinárias",
    rotuloEn: "Pet shops & veterinary",
    filtros: [
      { tags: [{ chave: "shop", valor: "pet" }] },
      { tags: [{ chave: "shop", valor: "pet_grooming" }] },
      { tags: [{ chave: "amenity", valor: "veterinary" }] },
    ],
  },
  {
    slug: "oficina",
    rotulo: "Oficinas mecânicas",
    rotuloEn: "Auto repair shops",
    filtros: [
      { tags: [{ chave: "shop", valor: "car_repair" }] },
      { tags: [{ chave: "shop", valor: "motorcycle_repair" }] },
      { tags: [{ chave: "shop", valor: "tyres" }] },
    ],
  },
  {
    slug: "landscaping",
    rotulo: "Paisagismo e jardinagem",
    rotuloEn: "Landscaping & gardening",
    filtros: [
      { tags: [{ chave: "craft", valor: "gardener" }] },
      { tags: [{ chave: "shop", valor: "garden_centre" }] },
    ],
  },
  {
    slug: "cleaning",
    rotulo: "Limpeza e lavanderia",
    rotuloEn: "Cleaning services",
    filtros: [
      { tags: [{ chave: "shop", valor: "laundry" }] },
      { tags: [{ chave: "shop", valor: "dry_cleaning" }] },
      { tags: [{ chave: "craft", valor: "cleaning" }] },
    ],
  },
  {
    slug: "plumbing",
    rotulo: "Encanadores e hidráulica",
    rotuloEn: "Plumbing",
    filtros: [{ tags: [{ chave: "craft", valor: "plumber" }] }],
  },
  {
    slug: "roofing",
    rotulo: "Telhados e coberturas",
    rotuloEn: "Roofing",
    filtros: [
      { tags: [{ chave: "craft", valor: "roofer" }] },
      { tags: [{ chave: "craft", valor: "carpenter" }] },
    ],
  },
] as const;

const PorSlug = new Map(SEGMENTOS.map((s) => [s.slug, s]));

/**
 * Segmento avulso, montado a partir de um par tag=valor do OSM.
 *
 * É o "permitir adicionar outros" da especificação. O slug recebe o
 * prefixo `custom:` para nunca colidir com os segmentos da lista, e o
 * par é validado antes de virar consulta.
 */
export function segmentoCustomizado(chave: string, valor: string): Segmento | null {
  const seguro = /^[a-z_][a-z0-9_:]{0,48}$/i;
  if (!seguro.test(chave) || !seguro.test(valor)) return null;

  return {
    slug: `custom:${chave}=${valor}`,
    rotulo: `${chave}=${valor}`,
    rotuloEn: `${chave}=${valor}`,
    filtros: [{ tags: [{ chave, valor }] }],
  };
}

export function acharSegmento(slug: string): Segmento | undefined {
  if (slug.startsWith("custom:")) {
    const [chave, valor] = slug.slice("custom:".length).split("=");
    return chave && valor ? (segmentoCustomizado(chave, valor) ?? undefined) : undefined;
  }
  return PorSlug.get(slug);
}

export function rotuloDoSegmento(slug: string, ingles = false): string {
  const s = acharSegmento(slug);
  if (!s) return slug;
  return ingles ? s.rotuloEn : s.rotulo;
}
