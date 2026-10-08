import { getBanco, plano } from "@/db/cliente";
import type { Busca } from "@/db/tipos";
import { ErroApi, json, rota } from "@/server/api";
import { resumir } from "@/worker/handlers/busca-provedor";

export const GET = rota(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { rows } = await getBanco().execute({ sql: `SELECT * FROM buscas WHERE id = ?`, args: [id] });
  if (!rows[0]) throw new ErroApi("Busca não encontrada.", 404);
  const busca = plano<Busca>(rows[0]);
  // Concluída: o resumo é recalculado a cada consulta, porque os e-mails
  // continuam chegando (visita aos sites) depois que a busca termina.
  const banco = getBanco();
  const salvo = busca.resumo ? (JSON.parse(busca.resumo) as { aviso?: string | null }) : null;
  const resumo = busca.status === "concluida" ? await resumir(banco, id, salvo?.aviso ?? null) : salvo;
  const { rows: pendentes } = await banco.execute({
    sql: `SELECT 1 FROM jobs WHERE tipo = 'enriquecer_email' AND status IN ('pendente', 'em_andamento') AND payload LIKE ? LIMIT 1`,
    args: [`%${id}%`],
  });
  return json({ busca, resumo, procurandoEmails: busca.status === "concluida" && pendentes.length > 0 });
});
