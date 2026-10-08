import { obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";

import { SaidaInvalida } from "./contexto";

/**
 * Pede à IA e confere a resposta. Se a conferência barrar (número que não
 * está nos dados, placeholder, saudação errada), pede de novo dizendo o
 * que estava errado — o modelo quase sempre corrige na segunda vez. Só
 * desiste depois de três tentativas, com uma mensagem que o operador
 * entende. Nada barrado chega à tela.
 */
export async function gerarConferido<T>(instrucao: string, esquema: EsquemaResposta, conferir: (bruto: unknown) => T, tentativas = 3): Promise<T> {
  let motivo = "";
  for (let i = 0; i < tentativas; i += 1) {
    const pedido = motivo
      ? `${instrucao}\n\nATENÇÃO: a resposta anterior foi descartada porque ${motivo}. Escreva de novo sem esse problema. Use só números que aparecem nos fatos, exatamente como estão; se não tiver certeza, não use número nenhum.`
      : instrucao;
    try {
      return conferir(await obterIA().gerarJson(pedido, esquema));
    } catch (erro) {
      if (!(erro instanceof SaidaInvalida)) throw erro;
      motivo = erro.message;
    }
  }
  throw new SaidaInvalida(`A IA tentou ${tentativas} vezes e escreveu algo que não confere com os dados da empresa (${motivo}). Tente de novo em instantes.`);
}
