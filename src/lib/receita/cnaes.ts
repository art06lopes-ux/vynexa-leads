/**
 * Tradução dos segmentos da Vynexa para códigos CNAE da Receita Federal.
 *
 * O mesmo raciocínio de `osm/segmentos.ts`: um segmento comercial é uma
 * lista de códigos, não um só. "Oficina" na Receita são sete subclasses
 * (mecânica, elétrica, funilaria, alinhamento…), e a busca é a união.
 *
 * Todo código abaixo foi conferido contra o arquivo Cnaes.zip da própria
 * Receita (referência 2026-09). Nada aqui é de memória.
 */

export const CNAES_POR_SEGMENTO: Record<string, readonly string[]> = {
  barbearia: ["9602501"],
  estetica: ["9602502", "9609201", "9609205", "9609206"],
  // Lavagem, lubrificação e polimento é onde lava-jato e estética
  // automotiva se registram; acessórios (4520007) é som e película.
  estetica_automotiva: ["4520005", "4520007"],
  clinica: [
    "8630501", "8630502", "8630503", "8630504", "8630599",
    "8650001", "8650002", "8650003", "8650004", "8650005", "8650006", "8650099",
  ],
  restaurante: ["5611201", "5611203", "5611204", "5611205", "5620104", "1091102"],
  // Mesmos CNAEs do restaurante: a Receita não distingue hamburgueria de
  // lanchonete/restaurante — quem separa é a tag `cuisine` do OSM.
  hamburgueria: ["5611201", "5611203"],
  academia: ["9313100"],
  petshop: ["4789004", "7500100", "9609208", "9609203"],
  oficina: ["4520001", "4520002", "4520003", "4520004", "4520006", "4520008", "4543900"],
  landscaping: ["8130300"],
  cleaning: ["9601701", "9601702", "8121400", "8129000", "8122200"],
  loja_roupas: ["4781400", "4782201"],
  imobiliaria: ["6821801", "6821802", "6822600"],
  advocacia: ["6911701"],
  contabilidade: ["6920601", "6920602"],
  arquitetura: ["7111100", "7112000"],
  hospedagem: ["5510801", "5510802", "5590601", "5590603"],
  farmacia: ["4771701", "4771702", "4771703"],
  otica: ["4774100"],
  cursos: ["8593700", "8592901", "8592902", "8592903", "8599603", "8599604", "8599605", "8599699"],
  construcao: ["4120400", "4321500", "4330402", "4330404"],
  moveis_decoracao: ["4754701", "4759801", "4755503"],
  floricultura: ["4789002"],
  informatica: ["4751201", "9511800"],
  loja_celular: ["4752100", "9512600"],
  fotografia_eventos: ["7420001", "7420004", "5620102", "8230001"],
  escolas: ["8511200", "8512100", "8513900", "8520100", "8599601"],
  seguranca: ["8011101", "8020000", "8020001", "8020002"],
  seguros_viagens: ["6622300", "7911200", "7912100"],
  assistencia_tecnica: ["9521500", "9529102", "9529101", "9529199"],
  materiais_construcao: ["4744099", "4741500", "4743100", "4744002", "4744005", "4744001"],
  marcenaria_serralheria: ["3101200", "2542000"],
  grafica: ["1813001", "1811301", "1812100"],
  lojas_especializadas: ["4763601", "4763602", "4763603", "4756300", "4761001", "4761003", "4753900", "4783101", "4783102", "4772500"],
  padaria_doceria: ["4721102", "4721104", "4723700", "1113502"],
  saude_complementar: ["8640202", "8711501", "8712300", "8690901", "8690903", "8690904", "8690999"],
  consultoria: ["7020400"],
  // Sem 7319002 ("promoção de vendas"): são 415 mil, quase todos MEI de
  // promotor de loja — não é agência.
  marketing: ["7311400", "7319003", "7319004", "7319099"],
  // Instalador solar se registra como instalação elétrica (4321500) ou
  // geração (3511501). O 4321500 também está em "construção": a mesma
  // empresa pode aparecer nas duas caçadas, e a carteira não duplica.
  energia_solar: ["3511501", "3511500", "4321500"],
  plumbing: ["4322301", "4322302"],
  // A Receita não tem "telhadista": cobertura entra em acabamento e
  // impermeabilização. É o mais próximo sem arrastar construtora inteira.
  roofing: ["4330401", "4330499", "4399103"],
};

/**
 * Segmentos cujos CNAEs só entram na base a partir de uma referência.
 *
 * O plano gratuito do Turso permite 10 milhões de linhas escritas por
 * mês, e a primeira carga de setembro de 2026 já consome quase tudo.
 * Estes segmentos existem desde já para o OpenStreetMap (que não escreve
 * nada em massa) e passam a vir da Receita na importação de outubro —
 * quando a cota renova e só o que mudou é reescrito.
 */
export const CNAES_A_PARTIR_DE: Record<string, string> = {
  escolas: "2026-10",
  seguranca: "2026-10",
  seguros_viagens: "2026-10",
  assistencia_tecnica: "2026-10",
  materiais_construcao: "2026-10",
  marcenaria_serralheria: "2026-10",
  grafica: "2026-10",
  lojas_especializadas: "2026-10",
  padaria_doceria: "2026-10",
  saude_complementar: "2026-10",
  consultoria: "2026-10",
};

/** CNAEs que a importação de uma referência (AAAA-MM) deve gravar. */
export function cnaesParaImportar(referencia: string): Set<string> {
  const conjunto = new Set<string>();
  for (const [slug, codigos] of Object.entries(CNAES_POR_SEGMENTO)) {
    const desde = CNAES_A_PARTIR_DE[slug];
    if (desde && referencia < desde) continue;
    for (const c of codigos) conjunto.add(c);
  }
  return conjunto;
}

/** Lista de CNAEs de um segmento; vazia para segmentos avulsos do OSM. */
export function cnaesDoSegmento(slug: string): readonly string[] {
  return CNAES_POR_SEGMENTO[slug] ?? [];
}
