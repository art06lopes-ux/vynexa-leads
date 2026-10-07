import { z } from "zod";

import { agora, ehLimiteDiarioD1, getBanco, MENSAGEM_COTA_D1 } from "@/db/cliente";

/**
 * Erros, respostas e rate limit das rotas — sem dependência do Next, para
 * poder ser testado direto. A tranca de sessão fica em `api.ts`.
 */

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status = 400,
    readonly codigo?: string,
  ) {
    super(mensagem);
  }
}

export function json(dados: unknown, status = 200): Response {
  return Response.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

export function respostaDeErro(erro: unknown): Response {
  if (erro instanceof ErroApi) return json({ erro: erro.message, codigo: erro.codigo }, erro.status);
  if (erro instanceof z.ZodError) {
    return json({ erro: "Alguns campos estão inválidos.", campos: erro.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })) }, 422);
  }
  if (ehLimiteDiarioD1(erro)) return json({ erro: MENSAGEM_COTA_D1, codigo: "cota_banco" }, 503);
  const semConfiguracao = Boolean((erro as { semConfiguracao?: boolean })?.semConfiguracao);
  const temporario = Boolean((erro as { temporario?: boolean })?.temporario);
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error("[api]", mensagem);
  if (semConfiguracao) return json({ erro: mensagem, codigo: "sem_configuracao" }, 409);
  if (temporario) return json({ erro: mensagem, codigo: "temporario" }, 503);
  // Erros de regra de negócio vêm como Error comum, com texto pensado
  // para o operador; o resto ganha uma frase genérica e honesta.
  return json({ erro: mensagem.length < 220 ? mensagem : "Não conseguimos concluir esta ação. Tente novamente em instantes.", codigo: "falha" }, 500);
}

export async function lerCorpo<T extends z.ZodTypeAny>(req: Request, esquema: T): Promise<z.infer<T>> {
  let bruto: unknown;
  try {
    bruto = await req.json();
  } catch {
    throw new ErroApi("Corpo da requisição inválido.");
  }
  return esquema.parse(bruto);
}

/**
 * Rate limit simples, no banco (a Vercel roda várias instâncias; memória
 * não é compartilhada). Janela fixa: `max` chamadas por `janelaSeg`.
 */
export async function limitar(chave: string, max: number, janelaSeg: number): Promise<void> {
  const janela = String(Math.floor(Date.now() / 1000 / janelaSeg));
  const banco = getBanco();
  const { rows } = await banco.execute({
    sql: `INSERT INTO limites (chave, janela, contagem) VALUES (?, ?, 1)
          ON CONFLICT(chave, janela) DO UPDATE SET contagem = contagem + 1
          RETURNING contagem`,
    args: [chave, janela],
  });
  const contagem = Number(rows[0]?.contagem ?? 1);
  if (contagem > max) {
    throw new ErroApi(`Muitas requisições seguidas. Aguarde ${janelaSeg >= 60 ? `${Math.ceil(janelaSeg / 60)} min` : `${janelaSeg} s`} e tente de novo.`, 429, "limite");
  }
  // Limpeza oportunista das janelas velhas (1 em ~50 chamadas).
  if (Math.random() < 0.02) {
    await banco.execute({ sql: `DELETE FROM limites WHERE janela < ?`, args: [String(Number(janela) - 2)] }).catch(() => {});
  }
}

export { agora };
