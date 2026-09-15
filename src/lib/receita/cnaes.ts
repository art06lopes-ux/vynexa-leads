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
  plumbing: ["4322301", "4322302"],
  // A Receita não tem "telhadista": cobertura entra em acabamento e
  // impermeabilização. É o mais próximo sem arrastar construtora inteira.
  roofing: ["4330401", "4330499", "4399103"],
};

/** Lista de CNAEs de um segmento; vazia para segmentos avulsos do OSM. */
export function cnaesDoSegmento(slug: string): readonly string[] {
  return CNAES_POR_SEGMENTO[slug] ?? [];
}
