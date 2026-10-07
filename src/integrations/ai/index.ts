import { obterSegredo } from "@/integrations/segredos";
import { ErroGemini, pedirJson } from "@/lib/ia/gemini";

import { ErroIA, type AIProvider, type EsquemaResposta } from "./tipos";

/** Gemini pela API REST (ver `src/lib/ia/gemini.ts`). */
export class GeminiProvider implements AIProvider {
  readonly nome = "gemini";

  async disponivel(): Promise<boolean> {
    return Boolean(await obterSegredo("GEMINI_API_KEY"));
  }

  async gerarJson<T>(instrucao: string, esquema: EsquemaResposta): Promise<T> {
    if (!(await this.disponivel())) {
      throw new ErroIA(
        "A IA não está configurada. Cole uma chave do Gemini em Configurações → Integrações.",
        false,
        true,
      );
    }
    try {
      return await pedirJson<T>(instrucao, esquema);
    } catch (erro) {
      if (erro instanceof ErroGemini) throw new ErroIA(erro.message, erro.temporario);
      throw erro;
    }
  }
}

let provedor: AIProvider | null = null;

export function obterIA(): AIProvider {
  provedor ??= new GeminiProvider();
  return provedor;
}

/** Só para testes: injeta um provedor falso. */
export function definirIA(p: AIProvider | null): void {
  provedor = p;
}

export { ErroIA };
export type { AIProvider };
