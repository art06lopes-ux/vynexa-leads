/**
 * Detecção de duplicatas.
 *
 * Quatro chaves, nesta ordem de confiança: o id da fonte (place_id,
 * osm_id, CNPJ), o telefone em E.164, o domínio do site próprio e, por
 * último, nome + endereço normalizados. Basta uma bater para ser a mesma
 * empresa — e aí o registro existente é COMPLETADO com o que a fonte nova
 * traz a mais, nunca duplicado.
 *
 * Este módulo é puro (sem banco): recebe o candidato e os registros já
 * conhecidos que poderiam casar. Quem busca esses registros é
 * `src/services/registro.ts`, pelas colunas indexadas.
 */

export type ChavesEmpresa = {
  id?: string;
  place_id: string | null;
  osm_id: string | null;
  cnpj: string | null;
  telefone_e164: string | null;
  dominio: string | null;
  nome_chave: string | null;
  endereco_chave: string | null;
  cidade: string | null;
};

export type MotivoDuplicata = "place_id" | "osm_id" | "cnpj" | "telefone" | "dominio" | "nome_endereco";

export const ROTULO_DUPLICATA: Record<MotivoDuplicata, string> = {
  place_id: "mesmo registro do Google Maps",
  osm_id: "mesmo registro do OpenStreetMap",
  cnpj: "mesmo CNPJ",
  telefone: "mesmo telefone",
  dominio: "mesmo site",
  nome_endereco: "mesmo nome e endereço",
};

function iguais(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && a === b;
}

function mesmaCidade(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // sem cidade num dos lados, o endereço decide sozinho
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Por que `a` e `b` são a mesma empresa — ou nulo, se não são. */
export function motivoDeDuplicata(a: ChavesEmpresa, b: ChavesEmpresa): MotivoDuplicata | null {
  if (iguais(a.place_id, b.place_id)) return "place_id";
  if (iguais(a.osm_id, b.osm_id)) return "osm_id";
  if (iguais(a.cnpj, b.cnpj)) return "cnpj";
  if (iguais(a.telefone_e164, b.telefone_e164)) return "telefone";
  if (iguais(a.dominio, b.dominio)) return "dominio";
  if (iguais(a.nome_chave, b.nome_chave) && iguais(a.endereco_chave, b.endereco_chave) && mesmaCidade(a.cidade, b.cidade)) {
    return "nome_endereco";
  }
  return null;
}

/** Primeiro registro conhecido que é a mesma empresa do candidato. */
export function acharDuplicata<T extends ChavesEmpresa>(
  candidato: ChavesEmpresa,
  conhecidos: readonly T[],
): { registro: T; motivo: MotivoDuplicata } | null {
  for (const registro of conhecidos) {
    const motivo = motivoDeDuplicata(candidato, registro);
    if (motivo) return { registro, motivo };
  }
  return null;
}

/**
 * Remove as duplicatas DENTRO de um mesmo lote — a mesma busca no Google
 * pode devolver a mesma empresa em duas páginas, ou duas filiais com o
 * mesmo telefone. Mantém a primeira ocorrência.
 */
export function deduplicarLote<T extends ChavesEmpresa>(lote: readonly T[]): { unicos: T[]; repetidos: number } {
  const unicos: T[] = [];
  let repetidos = 0;
  for (const item of lote) {
    if (acharDuplicata(item, unicos)) repetidos += 1;
    else unicos.push(item);
  }
  return { unicos, repetidos };
}
