import { getOsmUserAgent } from "@/lib/ambiente";
import { criarLimitador } from "@/lib/osm/limitador";
import type { FiltroOsm, Segmento } from "@/lib/osm/segmentos";
import type { Bbox } from "@/lib/osm/nominatim";

/**
 * Espelhos oficiais da Overpass. O principal cai com alguma frequência;
 * tentar o segundo antes de desistir evita que a ferramenta pareça
 * quebrada quando o problema é do outro lado.
 */
const ESPELHOS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const agendar = criarLimitador(1200);

export type ElementoOsm = {
  /** "node/123456" — chave natural da empresa. */
  osmId: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  latitude: number | null;
  longitude: number | null;
  categoria: string;
};

export class ErroOverpass extends Error {}

type RespostaOverpass = {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
};

function escapar(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function clausula(filtro: FiltroOsm): string {
  return filtro.tags
    .map(({ chave, valor, regex }) =>
      regex
        ? `["${escapar(chave)}"~"${escapar(valor)}"]`
        : `["${escapar(chave)}"="${escapar(valor)}"]`,
    )
    .join("");
}

export function montarConsulta(
  segmentos: readonly Segmento[],
  bbox: Bbox,
  limite: number,
): string {
  const area = `(${bbox.sul},${bbox.oeste},${bbox.norte},${bbox.leste})`;

  const linhas = segmentos
    .flatMap((s) => s.filtros)
    // `nwr` cobre node, way e relation de uma vez: um estabelecimento pode
    // estar mapeado como ponto ou como o polígono do prédio, e buscar só
    // `node` perde uma fatia grande dos resultados reais.
    .map((filtro) => `  nwr${clausula(filtro)}${area};`)
    .join("\n");

  // `out center` resolve way e relation não terem coordenada própria: a
  // Overpass calcula o centroide. Sem isso, metade sairia sem posição.
  return `[out:json][timeout:90];\n(\n${linhas}\n);\nout body center ${limite};`;
}

function satisfaz(tags: Record<string, string>, filtro: FiltroOsm): boolean {
  return filtro.tags.every(({ chave, valor, regex }) => {
    const presente = tags[chave];
    if (presente === undefined) return false;
    return regex ? new RegExp(valor, "i").test(presente) : presente === valor;
  });
}

function classificarSegmento(
  tags: Record<string, string>,
  segmentos: readonly Segmento[],
): string | null {
  for (const s of segmentos) {
    if (s.filtros.some((filtro) => satisfaz(tags, filtro))) return s.slug;
  }
  return null;
}

function primeiraTag(
  tags: Record<string, string>,
  chaves: string[],
): string | null {
  for (const chave of chaves) {
    const valor = tags[chave]?.trim();
    if (valor) return valor;
  }
  return null;
}

/**
 * Endereço montado a partir das tags `addr:*`.
 *
 * Cada parte é opcional porque o OSM raramente tem o endereço completo.
 * Devolve nulo quando não há nada: a interface prefere avisar "sem
 * endereço" a mostrar uma vírgula solta.
 */
function montarEndereco(tags: Record<string, string>): string | null {
  const rua = [tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join(", ");
  const partes = [rua, tags["addr:suburb"]].filter((p): p is string =>
    Boolean(p && p.trim()),
  );
  return partes.length > 0 ? partes.join(" - ") : null;
}

/**
 * Normaliza o identificador de rede social vindo do OSM.
 *
 * A tag `contact:instagram` aparece tanto como "@fulano" quanto como a
 * URL inteira. Guardar as duas formas misturadas quebraria qualquer
 * filtro depois, então tudo vira URL.
 *
 * Isto lê uma tag pública do OSM — não visita nem raspa a rede social,
 * o que violaria os termos de uso dela.
 */
function normalizarRedeSocial(
  bruto: string | null,
  dominio: string,
): string | null {
  if (!bruto) return null;
  const texto = bruto.trim();
  if (texto === "") return null;
  if (/^https?:\/\//i.test(texto)) return texto;
  return `https://${dominio}/${texto.replace(/^@/, "")}`;
}

export type ResultadoBusca = {
  elementos: ElementoOsm[];
  /** Quantos vieram da Overpass antes de descartar os sem nome. */
  brutos: number;
};

export async function buscarEstabelecimentos(
  segmentos: readonly Segmento[],
  bbox: Bbox,
  limite: number,
): Promise<ResultadoBusca> {
  if (segmentos.length === 0) return { elementos: [], brutos: 0 };

  const dados = await executar(montarConsulta(segmentos, bbox, limite));
  const brutos = dados.elements?.length ?? 0;

  const vistos = new Set<string>();
  const elementos: ElementoOsm[] = [];

  for (const elemento of dados.elements ?? []) {
    const tags = elemento.tags ?? {};

    // Sem nome não há abordagem possível: não dá para escrever a mensagem
    // nem para procurar o contato por fora.
    const nome = tags.name?.trim();
    if (!nome) continue;

    const categoria = classificarSegmento(tags, segmentos);
    if (categoria === null) continue;

    const osmId = `${elemento.type}/${elemento.id}`;
    if (vistos.has(osmId)) continue;
    vistos.add(osmId);

    elementos.push({
      osmId,
      nome,
      telefone: primeiraTag(tags, [
        "contact:phone",
        "phone",
        "contact:mobile",
        "mobile",
      ]),
      email: primeiraTag(tags, ["contact:email", "email"]),
      endereco: montarEndereco(tags),
      cidade: primeiraTag(tags, ["addr:city", "addr:town"]),
      estado: primeiraTag(tags, ["addr:state", "addr:province"]),
      website: primeiraTag(tags, ["contact:website", "website", "url"]),
      instagram: normalizarRedeSocial(
        primeiraTag(tags, ["contact:instagram", "instagram"]),
        "instagram.com",
      ),
      facebook: normalizarRedeSocial(
        primeiraTag(tags, ["contact:facebook", "facebook"]),
        "facebook.com",
      ),
      latitude: elemento.lat ?? elemento.center?.lat ?? null,
      longitude: elemento.lon ?? elemento.center?.lon ?? null,
      categoria,
    });
  }

  return { elementos, brutos };
}

type RespostaContagem = {
  elements?: Array<{ type: string; tags?: { total?: string } }>;
};

/**
 * Quantos estabelecimentos de cada segmento existem numa região — o
 * "Nichos com mais chance" para fora do Brasil, onde não há base da
 * Receita. Uma consulta só, com um bloco `out count` por segmento (é
 * barato: a Overpass só conta, não devolve os elementos).
 *
 * Ordem dos segmentos == ordem dos `out count` == ordem dos elementos
 * na resposta: é assim que a contagem volta a ser associada ao slug
 * certo, sem depender de nome de set no JSON.
 */
export function montarConsultaContagem(segmentos: readonly Segmento[], bbox: Bbox): string {
  const area = `(${bbox.sul},${bbox.oeste},${bbox.norte},${bbox.leste})`;

  const blocos = segmentos
    .map((s, i) => {
      const linhas = s.filtros.map((filtro) => `  nwr${clausula(filtro)}${area};`).join("\n");
      return `(\n${linhas}\n)->.s${i};`;
    })
    .join("\n");

  const contagens = segmentos.map((_, i) => `.s${i} out count;`).join("\n");

  return `[out:json][timeout:15];\n${blocos}\n${contagens}`;
}

/**
 * Executa a consulta de contagem — versão rápida da `executar`, sem as
 * duas voltas de retentativa com pausa de 30s: isto roda numa
 * requisição da interface enquanto o operador espera, não num job do
 * worker. Falhar rápido e mostrar "sem dado" é melhor que travar a tela.
 */
export async function contarPorSegmento(
  segmentos: readonly Segmento[],
  bbox: Bbox,
): Promise<Map<string, number>> {
  const consulta = montarConsultaContagem(segmentos, bbox);
  let ultimoErro: unknown = null;

  for (const espelho of ESPELHOS) {
    try {
      const resposta = await agendar(() =>
        fetch(espelho, {
          method: "POST",
          headers: {
            "User-Agent": getOsmUserAgent(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ data: consulta }),
          // 18s e não os 25/28 de folga da consulta normal: isto roda
          // dentro do `maxDuration` da rota (ver route.ts) e precisa
          // sobrar tempo para tentar o segundo espelho se o primeiro
          // falhar, sem estourar o teto da função na Vercel.
          signal: AbortSignal.timeout(18_000),
        }),
      );

      if (!resposta.ok) {
        ultimoErro = new ErroOverpass(`A Overpass respondeu ${resposta.status}.`);
        continue;
      }

      const dados = (await resposta.json()) as RespostaContagem;
      const resultado = new Map<string, number>();
      segmentos.forEach((s, i) => {
        const total = Number(dados.elements?.[i]?.tags?.total ?? 0);
        if (total > 0) resultado.set(s.slug, total);
      });
      return resultado;
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  throw ultimoErro instanceof ErroOverpass
    ? ultimoErro
    : new ErroOverpass("Não consegui falar com a Overpass API.");
}

async function executar(consulta: string): Promise<RespostaOverpass> {
  let ultimoErro: unknown = null;

  // Duas voltas pelos espelhos, com pausa entre elas: "ocupada" na
  // Overpass costuma durar segundos, não minutos, e devolver o job para
  // a fila custava de 5 a 15 minutos de espera por um soluço.
  for (let volta = 0; volta < 2; volta += 1) {
    if (volta > 0) await new Promise((r) => setTimeout(r, 30_000));
    for (const espelho of ESPELHOS) {
      try {
        const resposta = await agendar(() =>
          fetch(espelho, {
            method: "POST",
            headers: {
              "User-Agent": getOsmUserAgent(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ data: consulta }),
            // A Overpass entra em fila quando carregada; os 90s do
            // `timeout:` da consulta pedem margem maior aqui.
            signal: AbortSignal.timeout(120_000),
          }),
        );

        if (resposta.status === 429 || resposta.status === 504) {
          ultimoErro = new ErroOverpass(
            "A Overpass está sobrecarregada no momento. O job será tentado de novo.",
          );
          continue;
        }

        if (!resposta.ok) {
          ultimoErro = new ErroOverpass(
            `A Overpass respondeu ${resposta.status}.`,
          );
          continue;
        }

        return (await resposta.json()) as RespostaOverpass;
      } catch (erro) {
        ultimoErro = erro;
      }
    }
  }

  throw ultimoErro instanceof ErroOverpass
    ? ultimoErro
    : new ErroOverpass(
        "Não consegui falar com a Overpass API. O job será tentado de novo.",
      );
}
