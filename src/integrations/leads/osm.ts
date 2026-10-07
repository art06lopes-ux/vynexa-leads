import { resolverLugar } from "@/lib/osm/nominatim";
import { buscarEstabelecimentos } from "@/lib/osm/overpass";
import { acharSegmento } from "@/lib/osm/segmentos";

import { ErroProvedor, type ConsultaBusca, type LeadProvider, type LugarEncontrado, type Progresso, type ResultadoProvedor } from "./tipos";

/**
 * OpenStreetMap (Overpass + Nominatim) como provedor.
 *
 * Gratuito e sem chave, mas só cobre os segmentos que têm tag no OSM
 * (`src/lib/osm/segmentos.ts`) e quase nunca traz avaliação ou telefone.
 * A caçada completa — com expansão de raio e a base da Receita Federal —
 * continua no job `busca` (src/worker/handlers/busca.ts); este adaptador
 * é a versão de consulta única, usada quando a busca escolhe o OSM pelo
 * fluxo novo.
 */
export class OsmProvider implements LeadProvider {
  readonly fonte = "osm" as const;
  readonly rotulo = "OpenStreetMap";

  async disponivel(): Promise<boolean> {
    return true;
  }

  async buscar(consulta: ConsultaBusca, progresso?: Progresso): Promise<ResultadoProvedor> {
    const segmento = acharSegmento(consulta.termo);
    if (!segmento) {
      throw new ErroProvedor(
        `O OpenStreetMap só busca segmentos da lista (barbearia, estética, clínica…). "${consulta.termo}" não é um deles — use o Google Maps para termos livres.`,
      );
    }
    if (!consulta.pais) throw new ErroProvedor("Escolha um país para buscar no OpenStreetMap.");

    await progresso?.("Consultando OpenStreetMap…");
    const lugar = consulta.retangulo
      ? { bbox: consulta.retangulo, rotulo: "Área selecionada no mapa" }
      : await resolverLugar({ pais: consulta.pais, estado: consulta.estado, cidade: consulta.cidade });

    const { elementos } = await buscarEstabelecimentos([segmento], lugar.bbox, 2000);
    await progresso?.(`Encontrando empresas… ${elementos.length}`);

    const lugares: LugarEncontrado[] = elementos.map((e) => ({
      fonte: "osm",
      externoId: e.osmId,
      fonteUrl: `https://www.openstreetmap.org/${e.osmId}`,
      nome: e.nome,
      categoria: e.categoria,
      categoriaRotulo: segmento.rotulo,
      pais: consulta.pais!,
      estado: e.estado ?? consulta.estado,
      cidade: e.cidade ?? consulta.cidade,
      bairro: null,
      cep: null,
      endereco: e.endereco,
      latitude: e.latitude,
      longitude: e.longitude,
      telefone: e.telefone,
      email: e.email,
      website: e.website,
      instagram: e.instagram,
      facebook: e.facebook,
      avaliacaoNota: null,
      avaliacaoQtd: null,
      statusNegocio: null,
    }));

    return { lugares, requisicoes: 0, area: lugar.bbox, rotulo: lugar.rotulo, aviso: null };
  }
}
