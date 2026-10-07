import { obterSegredo } from "@/integrations/segredos";
import { ESTADOS_BR } from "@/lib/geo/estados-br";
import { resolverLugar } from "@/lib/osm/nominatim";

import { ErroProvedor, type ConsultaBusca, type LeadProvider, type LugarEncontrado, type Progresso, type Retangulo, type ResultadoProvedor } from "./tipos";

/**
 * Google Places API (New) — Text Search.
 *
 * API oficial, com chave: nada de raspar o Google Maps. Documentação:
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * CUSTO. A Text Search devolve no máximo 20 lugares por página e 60 por
 * consulta (3 páginas). Pedir telefone, site e avaliações põe a chamada
 * no SKU "Enterprise" — o Google dá uma cota mensal gratuita e cobra
 * depois dela, e exige conta de faturamento com cartão para emitir a
 * chave. Por isso cada busca tem um TETO de requisições
 * (`maxRequisicoes`, configurável) e o total do mês aparece na tela de
 * Configurações.
 *
 * COBERTURA. Uma área com mais de 60 resultados é dividida em quatro
 * quadrantes, e cada quadrante consultado de novo — até o teto de
 * requisições. Assim "barbearias em São Paulo" não para nas 60 primeiras,
 * mas também não dispara 500 chamadas sem o operador saber.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Só os campos usados. Cada campo a mais pode mudar o SKU cobrado. */
const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

type ComponenteEndereco = { longText?: string; shortText?: string; types?: string[] };

type LugarGoogle = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: ComponenteEndereco[];
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
};

type RespostaGoogle = { places?: LugarGoogle[]; nextPageToken?: string; error?: { message?: string; status?: string } };

/** Uma página da Text Search. Exportado para teste com `fetch` falso. */
export async function consultarPagina(
  chave: string,
  corpo: Record<string, unknown>,
  buscar: typeof fetch = fetch,
): Promise<RespostaGoogle> {
  const resposta = await buscar(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chave,
      "X-Goog-FieldMask": CAMPOS,
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });

  const dados = (await resposta.json().catch(() => ({}))) as RespostaGoogle;
  if (resposta.ok) return dados;

  const motivo = dados.error?.message ?? `HTTP ${resposta.status}`;
  if (resposta.status === 429) throw new ErroProvedor("Cota da Google Places API atingida. Tente mais tarde.", true);
  if (resposta.status >= 500) throw new ErroProvedor(`O Google respondeu ${resposta.status}. Tentaremos de novo.`, true);
  if (resposta.status === 403 || resposta.status === 401 || dados.error?.status === "PERMISSION_DENIED") {
    throw new ErroProvedor(
      `A chave da Google Places API foi recusada (${motivo}). Confira se a "Places API (New)" está ativada no projeto e se a chave não tem restrição de referer.`,
      false,
      true,
    );
  }
  throw new ErroProvedor(`O Google recusou a busca: ${motivo}`);
}

function componente(lista: ComponenteEndereco[] | undefined, tipo: string, curto = false): string | null {
  const c = lista?.find((x) => x.types?.includes(tipo));
  return (curto ? c?.shortText : c?.longText) ?? c?.longText ?? null;
}

/** Converte um lugar do Google para o formato comum. Puro. */
export function converterLugar(g: LugarGoogle, termo: string, paisPadrao: string | null): LugarEncontrado | null {
  const nome = g.displayName?.text?.trim();
  if (!g.id || !nome) return null;
  const comps = g.addressComponents;
  const pais = componente(comps, "country", true)?.toUpperCase() ?? paisPadrao ?? "ZZ";

  return {
    fonte: "google_places",
    externoId: g.id,
    fonteUrl: g.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${g.id}`,
    nome,
    categoria: termo,
    categoriaRotulo: g.primaryTypeDisplayName?.text ?? null,
    pais,
    estado: componente(comps, "administrative_area_level_1", pais === "BR" || pais === "US"),
    cidade: componente(comps, "locality") ?? componente(comps, "administrative_area_level_2") ?? componente(comps, "postal_town"),
    bairro: componente(comps, "sublocality_level_1") ?? componente(comps, "sublocality") ?? componente(comps, "neighborhood"),
    cep: componente(comps, "postal_code"),
    endereco: g.formattedAddress ?? null,
    latitude: g.location?.latitude ?? null,
    longitude: g.location?.longitude ?? null,
    // O número internacional traz o "+DDI": é o que deixa a normalização
    // segura em qualquer país, sem adivinhar plano de numeração.
    telefone: g.internationalPhoneNumber ?? g.nationalPhoneNumber ?? null,
    email: null, // o Google não publica e-mail; vem do site, depois
    website: g.websiteUri ?? null,
    instagram: null,
    facebook: null,
    avaliacaoNota: typeof g.rating === "number" ? g.rating : null,
    avaliacaoQtd: typeof g.userRatingCount === "number" ? g.userRatingCount : null,
    statusNegocio: g.businessStatus ?? null,
  };
}

function requisicoesTexto(n: number): string {
  return n === 1 ? "1 requisição" : `${n} requisições`;
}

/** Divide um retângulo em quatro. */
export function quadrantes(r: Retangulo): Retangulo[] {
  const latMeio = (r.sul + r.norte) / 2;
  const lngMeio = (r.oeste + r.leste) / 2;
  return [
    { sul: r.sul, oeste: r.oeste, norte: latMeio, leste: lngMeio },
    { sul: r.sul, oeste: lngMeio, norte: latMeio, leste: r.leste },
    { sul: latMeio, oeste: r.oeste, norte: r.norte, leste: lngMeio },
    { sul: latMeio, oeste: lngMeio, norte: r.norte, leste: r.leste },
  ];
}

/** Retângulo que contém um círculo (o Google só restringe por retângulo). */
export function retanguloDoCirculo(lat: number, lng: number, raioKm: number): Retangulo {
  const dLat = raioKm / 111.32;
  const dLng = raioKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { sul: lat - dLat, norte: lat + dLat, oeste: lng - dLng, leste: lng + dLng };
}

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export class GooglePlacesProvider implements LeadProvider {
  readonly fonte = "google_places" as const;
  readonly rotulo = "Google Maps";

  constructor(private readonly buscarHttp: typeof fetch = fetch) {}

  async disponivel(): Promise<boolean> {
    return Boolean(await obterSegredo("GOOGLE_PLACES_API_KEY"));
  }

  async buscar(consulta: ConsultaBusca, progresso?: Progresso): Promise<ResultadoProvedor> {
    const chave = await obterSegredo("GOOGLE_PLACES_API_KEY");
    if (!chave) {
      throw new ErroProvedor(
        "A Google Places API não está configurada. Cole a chave em Configurações → Integrações.",
        false,
        true,
      );
    }

    await progresso?.("Consultando Google Maps…");

    if (consulta.linkMaps) return this.buscarComoNoMaps(chave, consulta, consulta.linkMaps, progresso);

    // No Brasil a tela manda a sigla ("SC"); o geocodificador e o Google
    // entendem melhor o nome ("Santa Catarina").
    const estado = consulta.pais === "BR" && consulta.estado && ESTADOS_BR[consulta.estado.toUpperCase()] ? ESTADOS_BR[consulta.estado.toUpperCase()] : consulta.estado;

    // 1. Qual área cobrir.
    let area: Retangulo | null = consulta.retangulo;
    let rotulo: string | null = null;
    if (!area && consulta.centro && consulta.raioKm) {
      area = retanguloDoCirculo(consulta.centro.lat, consulta.centro.lng, consulta.raioKm);
    }
    if (!area && consulta.pais && (consulta.estado || consulta.cidade)) {
      // Geocodificação gratuita pelo Nominatim: não gasta requisição paga.
      try {
        const lugar = await resolverLugar({ pais: consulta.pais, estado, cidade: consulta.cidade });
        area = lugar.bbox;
        rotulo = lugar.rotulo;
        if (consulta.raioKm) area = retanguloDoCirculo(lugar.latitude, lugar.longitude, consulta.raioKm);
      } catch {
        area = null; // sem área: a localização vai no texto da consulta
      }
    }

    // 2. O texto. Com área, só o termo (+ bairro/CEP, que refinam dentro
    // dela); sem área, o local vai junto e o Google interpreta.
    const refinos = [consulta.bairro, consulta.cep].filter(Boolean).join(" ");
    const localTexto = [...new Set([consulta.bairro, consulta.cidade, estado, consulta.local].filter(Boolean))].join(", ");
    const textoComLocal = localTexto ? `${consulta.termo} em ${localTexto}` : consulta.termo;
    const textoNaArea = refinos ? `${consulta.termo} ${refinos}` : consulta.termo;

    const vistos = new Map<string, LugarEncontrado>();
    let requisicoes = 0;
    let aviso: string | null = null;

    const varrer = async (texto: string, retangulo: Retangulo | null): Promise<number> => {
      let token: string | undefined;
      let quantos = 0;
      for (let pagina = 0; pagina < 3; pagina += 1) {
        if (requisicoes >= consulta.maxRequisicoes) {
          aviso = `A busca parou no teto de ${requisicoesTexto(consulta.maxRequisicoes)} ao Google. Aumente o teto em "Mais filtros" para cobrir a área inteira.`;
          break;
        }
        const corpo: Record<string, unknown> = { textQuery: texto, pageSize: 20, languageCode: consulta.idioma };
        if (consulta.pais) corpo.regionCode = consulta.pais;
        if (retangulo) {
          corpo.locationRestriction = {
            rectangle: {
              low: { latitude: retangulo.sul, longitude: retangulo.oeste },
              high: { latitude: retangulo.norte, longitude: retangulo.leste },
            },
          };
        }
        if (token) corpo.pageToken = token;

        const dados = await consultarPagina(chave, corpo, this.buscarHttp);
        requisicoes += 1;
        for (const g of dados.places ?? []) {
          const l = converterLugar(g, consulta.termo, consulta.pais);
          if (l && l.externoId && !vistos.has(l.externoId)) vistos.set(l.externoId, l);
          quantos += 1;
        }
        await progresso?.(`Encontrando empresas… ${vistos.size}`);
        token = dados.nextPageToken;
        if (!token) break;
      }
      return quantos;
    };

    if (area) {
      // Fila de áreas: começa pela área toda; quem devolve o máximo (60)
      // provavelmente tem mais, e vira quatro quadrantes.
      const fila: Array<{ r: Retangulo; nivel: number }> = [{ r: area, nivel: 0 }];
      while (fila.length > 0 && requisicoes < consulta.maxRequisicoes) {
        const { r, nivel } = fila.shift()!;
        const quantos = await varrer(textoNaArea, r);
        if (quantos >= 60 && nivel < 4) fila.push(...quadrantes(r).map((q) => ({ r: q, nivel: nivel + 1 })));
      }
      if (fila.length > 0 && !aviso) {
        aviso = `Ainda há partes da área sem consultar (teto de ${requisicoesTexto(consulta.maxRequisicoes)}).`;
      }
    } else {
      await varrer(textoComLocal, null);
    }

    // Rede de segurança: a área veio errada (geocodificador achou outro
    // lugar com o mesmo nome) ou pequena demais. Uma consulta a mais, só
    // com o texto — como o próprio Google Maps faria.
    if (vistos.size === 0 && area && localTexto && requisicoes < consulta.maxRequisicoes) {
      area = null;
      await varrer(textoComLocal, null);
    }

    let lugares = [...vistos.values()];

    // Raio: o retângulo cobre os cantos, o círculo não. Corta o que ficou fora.
    const centro = consulta.centro;
    if (centro && consulta.raioKm) {
      lugares = lugares.filter(
        (l) => l.latitude === null || l.longitude === null || distanciaKm(centro, { lat: l.latitude, lng: l.longitude }) <= consulta.raioKm! * 1.02,
      );
    }

    // O retângulo de um estado pega pedaço do vizinho (SC × RS). Busca
    // por estado devolve só o estado; quem não tem estado no endereço fica.
    const uf = consulta.pais === "BR" && consulta.estado ? consulta.estado.toUpperCase() : null;
    if (uf && ESTADOS_BR[uf]) lugares = lugares.filter((l) => !l.estado || l.estado.toUpperCase() === uf);

    return { lugares, requisicoes, area, rotulo: rotulo ?? (localTexto || null), aviso };
  }

  /**
   * A mesma pesquisa que o operador fez no Maps: o texto como foi
   * digitado e o centro do mapa como `locationBias` (círculo). Viés, não
   * restrição — "hamburguerias manacapuru" já diz a cidade, e o Maps
   * também não corta o que fica fora da tela.
   */
  private async buscarComoNoMaps(
    chave: string,
    consulta: ConsultaBusca,
    link: NonNullable<ConsultaBusca["linkMaps"]>,
    progresso?: Progresso,
  ): Promise<ResultadoProvedor> {
    const vistos = new Map<string, LugarEncontrado>();
    let requisicoes = 0;
    let token: string | undefined;
    let aviso: string | null = null;

    for (let pagina = 0; pagina < 3; pagina += 1) {
      if (requisicoes >= consulta.maxRequisicoes) {
        aviso = `A busca parou no teto de ${requisicoesTexto(consulta.maxRequisicoes)} ao Google. Aumente o teto em "Mais filtros" para trazer mais resultados.`;
        break;
      }
      const corpo: Record<string, unknown> = { textQuery: link.consulta, pageSize: 20, languageCode: consulta.idioma };
      if (consulta.pais) corpo.regionCode = consulta.pais;
      if (link.centro) {
        corpo.locationBias = {
          circle: {
            center: { latitude: link.centro.lat, longitude: link.centro.lng },
            radius: Math.min((link.raioKm ?? 10) * 1000, 50_000),
          },
        };
      }
      if (token) corpo.pageToken = token;

      const dados = await consultarPagina(chave, corpo, this.buscarHttp);
      requisicoes += 1;
      for (const g of dados.places ?? []) {
        const l = converterLugar(g, consulta.termo, consulta.pais);
        if (l && l.externoId && !vistos.has(l.externoId)) vistos.set(l.externoId, l);
      }
      await progresso?.(`Encontrando empresas… ${vistos.size}`);
      token = dados.nextPageToken;
      if (!token) break;
    }

    const area = link.centro && link.raioKm ? retanguloDoCirculo(link.centro.lat, link.centro.lng, link.raioKm) : null;
    return { lugares: [...vistos.values()], requisicoes, area, rotulo: link.consulta, aviso };
  }
}
