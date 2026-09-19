import { alternarPausa } from "@/db/campanhas";
import { ehLimiteDiarioD1, MENSAGEM_COTA_D1 } from "@/db/cliente";
import { exigirSessaoNaApi } from "@/server/sessao";

export async function POST(_request: Request, { params }: RouteContext<"/api/campanhas/[id]/pausa">) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;

  let status: Awaited<ReturnType<typeof alternarPausa>>;
  try {
    status = await alternarPausa(id);
  } catch (erro) {
    if (!ehLimiteDiarioD1(erro)) throw erro;
    return Response.json({ erro: MENSAGEM_COTA_D1 }, { status: 503 });
  }

  if (status === null) return Response.json({ erro: "Campanha não encontrada." }, { status: 404 });
  return Response.json({ status });
}
