import { nichosPorRegiao } from "@/db/receita";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Ranking de segmentos por quantidade de estabelecimentos da Receita na
 * região — para o operador escolher o nicho antes de caçar. Ver
 * `nichosPorRegiao` em `src/db/receita.ts`.
 */
export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const params = new URL(request.url).searchParams;
  const uf = (params.get("uf") ?? "").trim();
  const cidade = params.get("cidade")?.trim() || null;

  if (uf === "") {
    return Response.json({ erro: "Informe o estado." }, { status: 400 });
  }

  try {
    const nichos = await nichosPorRegiao(uf, cidade);
    return Response.json({ nichos });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao consultar a Receita." },
      { status: 502 },
    );
  }
}
