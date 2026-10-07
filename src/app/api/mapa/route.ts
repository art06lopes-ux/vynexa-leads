import { leadsNoMapa } from "@/db/leads";
import { json, rota } from "@/server/api";
import { filtrosDaUrl } from "@/server/esquemas";

/** Pontos do mapa: só o necessário para o marcador e o popup. */
export const GET = rota(async (req) => {
  const url = new URL(req.url);
  const n = (k: string) => Number(url.searchParams.get(k));
  const area = ["sul", "oeste", "norte", "leste"].every((k) => url.searchParams.has(k) && Number.isFinite(n(k)))
    ? { sul: n("sul"), oeste: n("oeste"), norte: n("norte"), leste: n("leste") }
    : null;
  const leads = await leadsNoMapa(filtrosDaUrl(url.searchParams), area, 2000);
  return json({
    pontos: leads.map((l) => ({
      id: l.lead_id,
      nome: l.nome,
      categoria: l.categoria_rotulo ?? l.categoria,
      cidade: l.cidade,
      telefone: l.telefone,
      website: l.website,
      nota: l.avaliacao_nota,
      avaliacoes: l.avaliacao_qtd,
      statusSite: l.status_site,
      qualidade: l.site_qualidade,
      score: l.score_oportunidade,
      prioridade: l.prioridade,
      solucao: l.solucao_sugerida,
      lat: l.latitude,
      lng: l.longitude,
    })),
  });
});
