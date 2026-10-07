import "server-only";

import { exigirSessaoNaApi } from "@/server/sessao";

import { respostaDeErro } from "./erros";

/**
 * Base de toda rota de API autenticada.
 *
 * - confere a sessão (segunda camada além do proxy);
 * - valida o corpo com zod e devolve a lista de campos inválidos;
 * - nunca devolve "500 Internal Server Error" cru: toda exceção vira
 *   uma mensagem que o operador entende, e o detalhe vai para o log.
 */
export function rota<C>(manipulador: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const naoAutenticado = await exigirSessaoNaApi();
    if (naoAutenticado) return naoAutenticado;
    try {
      return await manipulador(req, ctx);
    } catch (erro) {
      return respostaDeErro(erro);
    }
  };
}


export { agora, ErroApi, json, lerCorpo, limitar, respostaDeErro } from "./erros";
