import { obterBusca } from "@/db/consultas";
import { exigirSessaoNaApi } from "@/server/sessao";

/** Status da busca, consultado em polling pela tela enquanto o job roda. */
export async function GET(_request: Request, { params }: RouteContext<"/api/buscas/[id]">) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const busca = await obterBusca(id);

  if (busca === null) {
    return Response.json({ erro: "Busca não encontrada." }, { status: 404 });
  }

  return Response.json(
    {
      status: busca.status,
      rotulo: busca.rotulo_resolvido,
      encontradas: busca.quantidade_encontrada,
      novas: busca.quantidade_nova,
      raioKm: busca.raio_final_km,
      expansoes: busca.expansoes,
      erro: busca.erro,
    },
    // Sem cache: o ponto desta rota é justamente mudar de resposta a cada
    // chamada enquanto o worker trabalha.
    { headers: { "Cache-Control": "no-store" } },
  );
}
