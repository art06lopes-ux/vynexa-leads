import { alternarPausa } from "@/db/campanhas";
import { exigirSessaoNaApi } from "@/server/sessao";

export async function POST(_request: Request, { params }: RouteContext<"/api/campanhas/[id]/pausa">) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const status = await alternarPausa(id);
  if (status === null) return Response.json({ erro: "Campanha não encontrada." }, { status: 404 });
  return Response.json({ status });
}
