import type { EsquemaResposta } from "@/lib/ia/gemini";

/**
 * Contrato de um provedor de IA.
 *
 * Os agentes (LeadAnalyzer, MessageGenerator…) só conhecem esta
 * interface: trocar o Gemini por outro modelo é escrever um provedor
 * novo, sem tocar em prompt nem em validação.
 */
export interface AIProvider {
  readonly nome: string;
  /** Há chave configurada? Não faz chamada. */
  disponivel(): Promise<boolean>;
  /** Pede uma resposta JSON que obedeça ao esquema. */
  gerarJson<T>(instrucao: string, esquema: EsquemaResposta): Promise<T>;
}

export class ErroIA extends Error {
  constructor(
    mensagem: string,
    /** Vale tentar de novo mais tarde (cota, sobrecarga). */
    readonly temporario = false,
    /** Falta configuração — a interface manda para Configurações. */
    readonly semConfiguracao = false,
  ) {
    super(mensagem);
  }
}

export type { EsquemaResposta };
