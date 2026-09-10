import { listarMunicipios } from "@/lib/geo/ibge";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Municípios de um estado brasileiro, do IBGE.
 *
 * Passa pelo servidor em vez de o navegador chamar o IBGE direto: assim
 * o cache de processo é aproveitado por todas as abas, e a chamada não
 * depende do CORS de um serviço de terceiro.
 */
export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const uf = new URL(request.url).searchParams.get("uf") ?? "";

  try {
    const municipios = await listarMunicipios(uf);
    return Response.json(
      { municipios },
      // Lista praticamente imutável: uma hora de cache no navegador poupa
      // a viagem toda vez que o operador troca de estado e volta.
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao consultar o IBGE." },
      { status: 502 },
    );
  }
}
