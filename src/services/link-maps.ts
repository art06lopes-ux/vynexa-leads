/**
 * Link do Google Maps → busca.
 *
 * O operador pesquisa no Maps ("hamburguerias manacapuru"), copia o link
 * da barra de endereço e cola aqui. O link não é aberto nem raspado: só
 * se lê o que está escrito nele — o texto pesquisado e o ponto onde o
 * mapa estava centrado — e a mesma pesquisa é refeita pela Places API
 * oficial, perto daquele ponto.
 *
 *   https://www.google.com/maps/search/hamburguerias+manacapuru/@-3.2880302,-60.6277183,15z?...
 *                                      └──── texto ──────────┘  └─ lat ──┘ └── lng ───┘ └zoom
 */

export type LinkMaps = {
  /** O que foi pesquisado no Maps, como o operador digitou. */
  consulta: string;
  /** Centro do mapa no momento da cópia, quando o link traz. */
  centro: { lat: number; lng: number } | null;
  /** Raio aproximado da área visível, em km (do zoom). */
  raioKm: number | null;
};

const HOSTS_MAPS = /^(www\.)?google\.[a-z.]{2,6}$|^maps\.google\.[a-z.]{2,6}$/i;
const HOSTS_CURTOS = /^(maps\.app\.goo\.gl|goo\.gl)$/i;

/** Parece um link do Google Maps (inclusive o curto, do botão Compartilhar)? */
export function pareceLinkMaps(texto: string): boolean {
  const t = texto.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    if (HOSTS_CURTOS.test(u.hostname)) return u.hostname.toLowerCase() !== "goo.gl" || u.pathname.startsWith("/maps");
    return HOSTS_MAPS.test(u.hostname) && (u.pathname.startsWith("/maps") || u.hostname.toLowerCase().startsWith("maps."));
  } catch {
    return false;
  }
}

export function ehLinkCurto(texto: string): boolean {
  try {
    return HOSTS_CURTOS.test(new URL(texto.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * Raio da área que o Maps mostrava. No zoom z, um pixel cobre
 * 156543·cos(lat)/2^z metros; uma janela típica tem ~1.200 px de largura,
 * então metade dela é o raio. Limitado a 1–50 km (o máximo do viés da
 * Places API).
 */
export function raioDoZoom(zoom: number, lat: number): number {
  const metrosPorPixel = (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  const km = (metrosPorPixel * 600) / 1000;
  return Math.round(Math.min(Math.max(km, 1), 50) * 10) / 10;
}

/** Lê um link completo do Google Maps. Nulo se não for um link de pesquisa. */
export function interpretarLinkMaps(texto: string): LinkMaps | null {
  if (!pareceLinkMaps(texto) || ehLinkCurto(texto)) return null;
  const u = new URL(texto.trim());

  let consulta: string | null = null;
  const busca = /\/maps\/search\/([^/@?]+)/.exec(u.pathname);
  if (busca) consulta = busca[1];
  // Formato antigo/alternativo: /maps?q=… ou /maps/search/?api=1&query=…
  consulta ??= u.searchParams.get("q") ?? u.searchParams.get("query");
  if (!consulta) return null;

  try {
    consulta = decodeURIComponent(consulta.replace(/\+/g, " "));
  } catch {
    consulta = consulta.replace(/\+/g, " ");
  }
  consulta = consulta.replace(/\s+/g, " ").trim();
  if (consulta.length < 2) return null;

  // "@lat,lng,15z" (ou "…,1234m" na vista de satélite).
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)([zm]))?/.exec(u.pathname);
  let centro: LinkMaps["centro"] = null;
  let raioKm: number | null = null;
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      centro = { lat, lng };
      if (at[4] === "z") raioKm = raioDoZoom(Number(at[3]), lat);
      else if (at[4] === "m") raioKm = Math.round(Math.min(Math.max(Number(at[3]) / 2000, 1), 50) * 10) / 10;
      else raioKm = 10;
    }
  }

  return { consulta: consulta.slice(0, 120), centro, raioKm };
}

/**
 * Link curto (maps.app.goo.gl/…) → link completo. Segue só os
 * redirecionamentos, sem baixar página nenhuma, e só aceita destino no
 * próprio Google Maps.
 */
export async function expandirLinkCurto(texto: string, buscar: typeof fetch = fetch): Promise<string | null> {
  let atual = texto.trim();
  for (let i = 0; i < 4; i += 1) {
    if (!ehLinkCurto(atual)) return pareceLinkMaps(atual) ? atual : null;
    const r = await buscar(atual, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) });
    const destino = r.headers.get("location");
    if (!destino) return null;
    atual = new URL(destino, atual).toString();
  }
  return pareceLinkMaps(atual) && !ehLinkCurto(atual) ? atual : null;
}
