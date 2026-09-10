/**
 * Estados e municípios do Brasil, pela API de Localidades do IBGE.
 *
 * Pública, sem cadastro e sem chave. É a fonte oficial, o que evita
 * manter na mão uma lista de 5.570 municípios que muda de tempos em
 * tempos. https://servicodados.ibge.gov.br/api/docs/localidades
 *
 * Para outros países não existe equivalente gratuito e universal de
 * subdivisões — por isso a busca internacional usa campo de texto livre
 * resolvido pelo Nominatim, e não seletores.
 */

const BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

export type UF = { sigla: string; nome: string };

/**
 * Cache de processo com prazo.
 *
 * A lista de municípios de um estado tem centenas de itens e praticamente
 * não muda. Guardar por 24h evita repetir a chamada a cada vez que o
 * formulário é aberto, sem congelar o dado para sempre.
 */
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { em: number; dados: unknown }>();

async function buscarComCache<T>(chave: string, url: string): Promise<T> {
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < UM_DIA_MS) return guardado.dados as T;

  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resposta.ok) {
    throw new Error(`A API de localidades do IBGE respondeu ${resposta.status}.`);
  }

  const dados = (await resposta.json()) as T;
  cache.set(chave, { em: Date.now(), dados });
  return dados;
}

export async function listarEstados(): Promise<UF[]> {
  const dados = await buscarComCache<Array<{ sigla: string; nome: string }>>(
    "estados",
    `${BASE}/estados?orderBy=nome`,
  );
  return dados.map(({ sigla, nome }) => ({ sigla, nome }));
}

export async function listarMunicipios(uf: string): Promise<string[]> {
  const sigla = uf.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(sigla)) return [];

  const dados = await buscarComCache<Array<{ nome: string }>>(
    `municipios:${sigla}`,
    `${BASE}/estados/${sigla}/municipios?orderBy=nome`,
  );
  return dados.map((m) => m.nome);
}
