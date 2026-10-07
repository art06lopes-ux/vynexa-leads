import { idsDosLeads } from "@/db/leads";
import { json, rota } from "@/server/api";
import { filtrosDaUrl } from "@/server/esquemas";

/** "Selecionar os N melhores" — os ids que casam com o filtro, por score. */
export const GET = rota(async (req) => {
  const url = new URL(req.url);
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 50, 1), 1000);
  return json({ ids: await idsDosLeads(filtrosDaUrl(url.searchParams), limite) });
});
