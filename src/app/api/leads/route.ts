import { listarLeads } from "@/db/leads";
import { json, rota } from "@/server/api";
import { filtrosDaUrl } from "@/server/esquemas";

/** Lista paginada (rolagem infinita na busca e na lista de leads). */
export const GET = rota(async (req) => {
  const url = new URL(req.url);
  const pagina = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const porPagina = Math.min(Math.max(Number(url.searchParams.get("porPagina")) || 24, 1), 100);
  return json(await listarLeads(filtrosDaUrl(url.searchParams), pagina, porPagina));
});
