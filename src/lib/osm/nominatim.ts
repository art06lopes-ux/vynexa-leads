import { getOsmUserAgent } from "@/lib/ambiente";
import { criarLimitador } from "@/lib/osm/limitador";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** 1 req/s é o teto da política pública. 1,1s dá folga. */
const agendar = criarLimitador(1100);

/**
 * Cache de processo.
 *
 * A política do Nominatim pede explicitamente que resultados sejam
 * guardados do lado do cliente; consultas idênticas repetidas levam a
 * bloqueio. https://operations.osmfoundation.org/policies/nominatim/
 */
const cache = new Map<string, LugarResolvido>();

/** Ordem sul, oeste, norte, leste — a mesma que a Overpass espera. */
export type Bbox = { sul: number; oeste: number; norte: number; leste: number };

export type LugarResolvido = {
  rotulo: string;
  latitude: number;
  longitude: number;
  bbox: Bbox;
};

export class ErroNominatim extends Error {}

export type ConsultaLugar = {
  /** ISO 3166-1 alpha-2, em minúsculas. */
  pais: string;
  estado?: string | null;
  cidade?: string | null;
};

/**
 * Resolve país/estado/cidade em coordenadas.
 *
 * Usa a busca estruturada do Nominatim (`country`/`state`/`city`) em vez
 * de jogar tudo num `q` livre: com os campos separados, "Georgia" o
 * estado americano não é confundido com "Georgia" o país, que é
 * exatamente o tipo de erro que uma busca internacional produz.
 */
export async function resolverLugar(consulta: ConsultaLugar): Promise<LugarResolvido> {
  const pais = consulta.pais.trim().toLowerCase();
  const estado = consulta.estado?.trim() || undefined;
  const cidade = consulta.cidade?.trim() || undefined;

  if (pais.length !== 2) {
    throw new ErroNominatim("País inválido: use o código ISO de duas letras, como BR ou US.");
  }

  const chave = `${pais}|${estado ?? ""}|${cidade ?? ""}`.toLowerCase();
  const guardado = cache.get(chave);
  if (guardado) return guardado;

  const url = new URL(ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", pais);
  if (estado) url.searchParams.set("state", estado);
  if (cidade) url.searchParams.set("city", cidade);
  // Sem cidade nem estado a busca é o país inteiro, e aí o `country`
  // precisa ir explícito — `countrycodes` sozinho é só um filtro.
  if (!estado && !cidade) url.searchParams.set("country", pais);
  url.searchParams.set("accept-language", "pt-BR,en");

  const resposta = await agendar(() =>
    fetch(url, {
      headers: { "User-Agent": getOsmUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }),
  );

  if (!resposta.ok) {
    throw new ErroNominatim(
      `O serviço de geocodificação respondeu ${resposta.status}. Tente de novo em alguns segundos.`,
    );
  }

  const dados = (await resposta.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    boundingbox?: [string, string, string, string];
  }>;

  const primeiro = dados[0];
  if (!primeiro?.boundingbox || !primeiro.lat || !primeiro.lon) {
    const alvo = [cidade, estado, pais.toUpperCase()].filter(Boolean).join(", ");
    throw new ErroNominatim(`Não encontrei "${alvo}" no OpenStreetMap. Confira a grafia.`);
  }

  // ATENÇÃO à ordem: o Nominatim devolve [minlat, maxlat, minlon, maxlon],
  // a Overpass espera (sul, oeste, norte, leste). Trocar é silencioso —
  // a busca volta vazia ou pega o lugar errado, sem erro nenhum.
  const [minLat, maxLat, minLon, maxLon] = primeiro.boundingbox.map(Number);

  const resolvido: LugarResolvido = {
    rotulo: primeiro.display_name ?? chave,
    latitude: Number(primeiro.lat),
    longitude: Number(primeiro.lon),
    bbox: { sul: minLat, oeste: minLon, norte: maxLat, leste: maxLon },
  };

  cache.set(chave, resolvido);
  return resolvido;
}

// ---------------------------------------------------------------------
// Geometria da expansão de raio
// ---------------------------------------------------------------------

const KM_POR_GRAU_LAT = 111.32;

/**
 * Expande a bbox em torno do próprio centro.
 *
 * A correção por cosseno da latitude não é preciosismo: sem ela, expandir
 * 10 km em longitude perto do equador e perto de Porto Alegre produziria
 * áreas muito diferentes, e a expansão ficaria imprevisível conforme a
 * cidade. O limite de 89,5° evita a divisão por zero nos polos.
 */
export function expandirBbox(bbox: Bbox, km: number): Bbox {
  const centroLat = (bbox.sul + bbox.norte) / 2;
  const grausLat = km / KM_POR_GRAU_LAT;
  const cos = Math.cos((Math.min(Math.abs(centroLat), 89.5) * Math.PI) / 180);
  const grausLon = km / (KM_POR_GRAU_LAT * Math.max(cos, 0.01));

  return {
    sul: Math.max(bbox.sul - grausLat, -90),
    norte: Math.min(bbox.norte + grausLat, 90),
    oeste: Math.max(bbox.oeste - grausLon, -180),
    leste: Math.min(bbox.leste + grausLon, 180),
  };
}

/** Diagonal aproximada da bbox, em km. Usada só para registrar o alcance. */
export function raioAproximadoKm(bbox: Bbox): number {
  const alturaKm = (bbox.norte - bbox.sul) * KM_POR_GRAU_LAT;
  const centroLat = (bbox.sul + bbox.norte) / 2;
  const larguraKm =
    (bbox.leste - bbox.oeste) * KM_POR_GRAU_LAT * Math.cos((centroLat * Math.PI) / 180);
  return Math.round(Math.max(alturaKm, larguraKm) / 2);
}
