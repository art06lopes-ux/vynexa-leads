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
    slug: "hamburgueria",
    rotulo: "Hamburgueria",
    rotuloEn: "Burger joints",
    // O OSM não tem tag própria para hamburgueria: é `amenity` de comida
    // rápida ou restaurante com `cuisine=burger` (multivalorado, por
    // isso o `regex`). Sem esta separação, hamburgueria some dentro do
    // segmento genérico "Restaurantes e cafés".
    filtros: [
      { tags: [{ chave: "amenity", valor: "fast_food" }, { chave: "cuisine", valor: "burger", regex: true }] },
      { tags: [{ chave: "amenity", valor: "restaurant" }, { chave: "cuisine", valor: "burger", regex: true }] },
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
    slug: "loja_roupas",
    rotulo: "Lojas de roupas e calçados",
    rotuloEn: "Clothing & shoe stores",
    filtros: [
      { tags: [{ chave: "shop", valor: "clothes" }] },
      { tags: [{ chave: "shop", valor: "shoes" }] },
      { tags: [{ chave: "shop", valor: "boutique" }] },
    ],
  },
  {
    slug: "imobiliaria",
    rotulo: "Imobiliárias e corretores",
    rotuloEn: "Real estate agencies",
    filtros: [{ tags: [{ chave: "office", valor: "estate_agent" }] }],
  },
  {
    slug: "advocacia",
    rotulo: "Escritórios de advocacia",
    rotuloEn: "Law firms",
    filtros: [{ tags: [{ chave: "office", valor: "lawyer" }] }],
  },
  {
    slug: "contabilidade",
    rotulo: "Contabilidade",
    rotuloEn: "Accounting firms",
    filtros: [{ tags: [{ chave: "office", valor: "accountant" }] }],
  },
  {
    slug: "arquitetura",
    rotulo: "Arquitetura e engenharia",
    rotuloEn: "Architecture & engineering",
    filtros: [
      { tags: [{ chave: "office", valor: "architect" }] },
      { tags: [{ chave: "office", valor: "engineer" }] },
    ],
  },
  {
    slug: "hospedagem",
    rotulo: "Hotéis e pousadas",
    rotuloEn: "Hotels & guest houses",
    filtros: [
      { tags: [{ chave: "tourism", valor: "hotel" }] },
      { tags: [{ chave: "tourism", valor: "guest_house" }] },
      { tags: [{ chave: "tourism", valor: "hostel" }] },
    ],
  },
  {
    slug: "farmacia",
    rotulo: "Farmácias e drogarias",
    rotuloEn: "Pharmacies",
    filtros: [{ tags: [{ chave: "amenity", valor: "pharmacy" }] }],
  },
  {
    slug: "otica",
    rotulo: "Óticas",
    rotuloEn: "Opticians",
    filtros: [{ tags: [{ chave: "shop", valor: "optician" }] }],
  },
  {
    slug: "cursos",
    rotulo: "Cursos e escolas livres",
    rotuloEn: "Courses & schools",
    filtros: [
      { tags: [{ chave: "amenity", valor: "language_school" }] },
      { tags: [{ chave: "amenity", valor: "music_school" }] },
      { tags: [{ chave: "amenity", valor: "dancing_school" }] },
      { tags: [{ chave: "amenity", valor: "driving_school" }] },
      { tags: [{ chave: "amenity", valor: "training" }] },
    ],
  },
  {
    slug: "construcao",
    rotulo: "Construção, reforma e pintura",
    rotuloEn: "Construction & remodeling",
    filtros: [
      { tags: [{ chave: "craft", valor: "painter" }] },
      { tags: [{ chave: "craft", valor: "electrician" }] },
      { tags: [{ chave: "office", valor: "construction_company" }] },
      { tags: [{ chave: "craft", valor: "joiner" }] },
    ],
  },
  {
    slug: "moveis_decoracao",
    rotulo: "Móveis e decoração",
    rotuloEn: "Furniture & home decor",
    filtros: [
      { tags: [{ chave: "shop", valor: "furniture" }] },
      { tags: [{ chave: "shop", valor: "interior_decoration" }] },
      { tags: [{ chave: "shop", valor: "curtain" }] },
    ],
  },
  {
    slug: "floricultura",
    rotulo: "Floriculturas",
    rotuloEn: "Florists",
    filtros: [{ tags: [{ chave: "shop", valor: "florist" }] }],
  },
  {
    slug: "informatica",
    rotulo: "Informática e eletrônicos",
    rotuloEn: "Computer & electronics shops",
    filtros: [
      { tags: [{ chave: "shop", valor: "computer" }] },
      { tags: [{ chave: "shop", valor: "electronics" }] },
    ],
  },
  {
    slug: "loja_celular",
    rotulo: "Loja de celular e iPhone",
    rotuloEn: "Mobile phone shops",
    filtros: [{ tags: [{ chave: "shop", valor: "mobile_phone" }] }],
  },
  {
    slug: "fotografia_eventos",
    rotulo: "Fotografia, buffet e eventos",
    rotuloEn: "Photography, catering & events",
    filtros: [
      { tags: [{ chave: "craft", valor: "photographer" }] },
      { tags: [{ chave: "shop", valor: "photo" }] },
      { tags: [{ chave: "craft", valor: "caterer" }] },
      { tags: [{ chave: "amenity", valor: "events_venue" }] },
    ],
  },
  {
    slug: "escolas",
    rotulo: "Escolas e creches",
    rotuloEn: "Schools & daycare",
    filtros: [
      { tags: [{ chave: "amenity", valor: "kindergarten" }] },
      { tags: [{ chave: "amenity", valor: "school" }] },
      { tags: [{ chave: "amenity", valor: "childcare" }] },
    ],
  },
  {
    slug: "seguranca",
    rotulo: "Segurança e monitoramento",
    rotuloEn: "Security services",
    filtros: [{ tags: [{ chave: "office", valor: "security" }] }],
  },
  {
    slug: "seguros_viagens",
    rotulo: "Seguros e agências de viagens",
    rotuloEn: "Insurance & travel agencies",
    filtros: [
      { tags: [{ chave: "office", valor: "insurance" }] },
      { tags: [{ chave: "shop", valor: "travel_agency" }] },
    ],
  },
  {
    slug: "assistencia_tecnica",
    rotulo: "Assistência técnica e consertos",
    rotuloEn: "Repair services",
    filtros: [
      { tags: [{ chave: "shop", valor: "electronics_repair" }] },
      { tags: [{ chave: "craft", valor: "locksmith" }] },
      { tags: [{ chave: "craft", valor: "shoemaker" }] },
      { tags: [{ chave: "shop", valor: "appliance" }] },
    ],
  },
  {
    slug: "materiais_construcao",
    rotulo: "Materiais de construção e tintas",
    rotuloEn: "Building supplies",
    filtros: [
      { tags: [{ chave: "shop", valor: "doityourself" }] },
      { tags: [{ chave: "shop", valor: "hardware" }] },
      { tags: [{ chave: "shop", valor: "paint" }] },
      { tags: [{ chave: "shop", valor: "glaziery" }] },
      { tags: [{ chave: "shop", valor: "trade" }] },
    ],
  },
  {
    slug: "marcenaria_serralheria",
    rotulo: "Marcenarias e serralherias",
    rotuloEn: "Carpentry & metalwork",
    filtros: [
      { tags: [{ chave: "craft", valor: "carpenter" }] },
      { tags: [{ chave: "craft", valor: "metal_construction" }] },
      { tags: [{ chave: "craft", valor: "blacksmith" }] },
    ],
  },
  {
    slug: "grafica",
    rotulo: "Gráficas",
    rotuloEn: "Print shops",
    filtros: [
      { tags: [{ chave: "shop", valor: "copyshop" }] },
      { tags: [{ chave: "craft", valor: "printer" }] },
    ],
  },
  {
    slug: "lojas_especializadas",
    rotulo: "Lojas especializadas",
    rotuloEn: "Specialty stores",
    filtros: [
      { tags: [{ chave: "shop", valor: "toys" }] },
      { tags: [{ chave: "shop", valor: "sports" }] },
      { tags: [{ chave: "shop", valor: "bicycle" }] },
      { tags: [{ chave: "shop", valor: "musical_instrument" }] },
      { tags: [{ chave: "shop", valor: "books" }] },
      { tags: [{ chave: "shop", valor: "stationery" }] },
      { tags: [{ chave: "shop", valor: "jewelry" }] },
      { tags: [{ chave: "shop", valor: "cosmetics" }] },
      { tags: [{ chave: "shop", valor: "perfumery" }] },
    ],
  },
  {
    slug: "padaria_doceria",
    rotulo: "Padarias, docerias e bebidas",
    rotuloEn: "Bakeries, sweets & liquor stores",
    filtros: [
      { tags: [{ chave: "shop", valor: "bakery" }] },
      { tags: [{ chave: "shop", valor: "pastry" }] },
      { tags: [{ chave: "shop", valor: "confectionery" }] },
      { tags: [{ chave: "shop", valor: "alcohol" }] },
      { tags: [{ chave: "shop", valor: "wine" }] },
      { tags: [{ chave: "craft", valor: "brewery" }] },
    ],
  },
  {
    slug: "saude_complementar",
    rotulo: "Laboratórios, terapias e cuidado",
    rotuloEn: "Labs, therapies & elder care",
    filtros: [
      { tags: [{ chave: "healthcare", valor: "laboratory" }] },
      { tags: [{ chave: "healthcare", valor: "alternative" }] },
      { tags: [{ chave: "healthcare", valor: "podiatrist" }] },
      { tags: [{ chave: "amenity", valor: "nursing_home" }] },
      { tags: [{ chave: "amenity", valor: "social_facility" }] },
    ],
  },
  {
    slug: "consultoria",
    rotulo: "Consultoria empresarial",
    rotuloEn: "Business consulting",
    filtros: [{ tags: [{ chave: "office", valor: "consulting" }] }],
  },
  {
    slug: "marketing",
    rotulo: "Agências de marketing e publicidade",
    rotuloEn: "Marketing & advertising agencies",
    filtros: [
      { tags: [{ chave: "office", valor: "advertising_agency" }] },
      { tags: [{ chave: "office", valor: "marketing" }] },
    ],
  },
  {
    slug: "energia_solar",
    rotulo: "Energia solar",
    rotuloEn: "Solar energy installers",
    filtros: [
      { tags: [{ chave: "shop", valor: "energy" }] },
      { tags: [{ chave: "office", valor: "energy_supplier" }] },
      { tags: [{ chave: "craft", valor: "electrician" }] },
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
