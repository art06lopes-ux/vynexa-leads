import { getBanco, plano } from "@/db/cliente";
import type { Busca } from "@/db/tipos";
import { ErroApi, json, rota } from "@/server/api";
import { resumir } from "@/worker/handlers/busca-provedor";

export const GET = rota(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { rows } = await getBanco().execute({ sql: `SELECT * FROM buscas WHERE id = ?`, args: [id] });
  if (!rows[0]) throw new ErroApi("Busca não encontrada.", 404);
  const busca = plano<Busca>(rows[0]);
  // Buscas do OSM (job antigo) não gravam resumo: calcula na hora.
  const resumo = busca.resumo ? JSON.parse(busca.resumo) : busca.status === "concluida" ? await resumir(getBanco(), id, null) : null;
  return json({ busca, resumo });
});
