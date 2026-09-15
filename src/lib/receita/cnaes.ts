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
  informatica_celular: ["4751201", "4752100", "9511800", "9512600"],
  fotografia_eventos: ["7420001", "7420004", "5620102", "8230001"],
  plumbing: ["4322301", "4322302"],
  // A Receita não tem "telhadista": cobertura entra em acabamento e
  // impermeabilização. É o mais próximo sem arrastar construtora inteira.
  roofing: ["4330401", "4330499", "4399103"],
};

/** Lista de CNAEs de um segmento; vazia para segmentos avulsos do OSM. */
export function cnaesDoSegmento(slug: string): readonly string[] {
  return CNAES_POR_SEGMENTO[slug] ?? [];
}
