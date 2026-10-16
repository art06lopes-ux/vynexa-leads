import "server-only";

import type { Recurso } from "@/lib/planos";
import { exigirSessaoNaApi, sessaoAtual } from "@/server/sessao";

import { respostaDeErro } from "./erros";

/**
 * Base de toda rota de API autenticada.
 *
 * - confere a sessão (segunda camada além do proxy);
 * - valida o corpo com zod e devolve a lista de campos inválidos;
 * - nunca devolve "500 Internal Server Error" cru: toda exceção vira
 *   uma mensagem que o operador entende, e o detalhe vai para o log.
 */
export function rota<C>(manipulador: (req: Request, ctx: C) => Promise<Response>, opcoes: { recurso?: Recurso } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const naoAutenticado = await exigirSessaoNaApi();
    if (naoAutenticado) return naoAutenticado;
    if (opcoes.recurso && !(await sessaoAtual())?.recursos.includes(opcoes.recurso)) {
      return Response.json({ erro: "Este recurso não faz parte do seu plano. Veja os planos em Assinatura.", codigo: "plano" }, { status: 403 });
    }
    try {
      return await manipulador(req, ctx);
    } catch (erro) {
      return respostaDeErro(erro);
    }
  };
}


export { agora, ErroApi, json, lerCorpo, limitar, respostaDeErro } from "./erros";
