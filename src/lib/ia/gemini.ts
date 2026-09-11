import { criarLimitador } from "@/lib/osm/limitador";

/**
 * Cliente do Gemini, pela API REST.
 *
 * Sem SDK de propósito: é uma chamada HTTP com um corpo JSON, e o worker
 * roda em Node puro no GitHub Actions. Uma dependência a mais só
 * acrescentaria peso de instalação a cada execução do cron.
 *
 * Modelo: `gemini-3.5-flash-lite`. Está no free tier e é o mais rápido e
 * barato da família — o trabalho aqui é classificar e redigir texto
 * curto, em volume, que é exatamente o caso de uso dele. Os modelos Pro
 * saíram do free tier e não entram neste projeto por causa da restrição
 * de custo zero.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODELO = "gemini-3.5-flash-lite";

/**
 * Uma chamada a cada 2 segundos.
 *
 * O free tier tem limite por minuto e a documentação não publica o
 * número — ele aparece no painel do AI Studio e varia. Dois segundos
 * (30 por minuto) fica abaixo de qualquer teto plausível e ainda dá
 * conta de dezenas de leads por execução do worker.
 */
const agendar = criarLimitador(2000);

export class ErroGemini extends Error {
  /** Verdadeiro quando vale tentar de novo mais tarde (cota, sobrecarga). */
  readonly temporario: boolean;

  constructor(mensagem: string, temporario = false) {
    super(mensagem);
    this.temporario = temporario;
  }
}

/** Subconjunto do JSON Schema que a API aceita em `response_format.schema`. */
export type EsquemaResposta = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
};

export function getChaveGemini(): string {
  const chave = (process.env.GEMINI_API_KEY ?? "").replace(/\s+/g, "");
  if (chave === "") {
    throw new ErroGemini(
      "GEMINI_API_KEY ausente. Gere uma chave gratuita em https://aistudio.google.com/apikey e cadastre nos segredos do GitHub. Ver docs/SETUP.md.",
    );
  }
  return chave;
}

/**
 * Pede ao modelo uma resposta que obedeça ao esquema, e devolve o objeto.
 *
 * O `response_format` faz o próprio serviço garantir JSON sintaticamente
 * válido. Isso não garante conteúdo correto — quem valida os valores é
 * quem chama, e é por isso que o handler confere faixa de score e
 * tamanho de mensagem antes de gravar.
 */
export async function pedirJson<T>(
  instrucao: string,
  esquema: EsquemaResposta,
): Promise<T> {
  const resposta = await agendar(() =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": getChaveGemini(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        input: instrucao,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: esquema,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    }),
  );

  if (resposta.status === 429) {
    throw new ErroGemini("Cota do Gemini atingida por agora. O job será tentado de novo.", true);
  }
  if (resposta.status >= 500) {
    throw new ErroGemini(`O Gemini respondeu ${resposta.status}. Tentaremos de novo.`, true);
  }
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    // 400 e 403 costumam ser chave inválida ou modelo indisponível: erro
    // de configuração, não de momento. Repetir não resolveria.
    throw new ErroGemini(
      `O Gemini recusou a requisição (${resposta.status}). ${corpo.slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as Record<string, unknown>;
  const texto = extrairTexto(dados);

  if (texto === null) {
    // Inclui as chaves de primeiro nível: se a API mudar de forma outra
    // vez, o erro já diz onde procurar em vez de exigir uma investigação.
    throw new ErroGemini(
      `Resposta do Gemini sem texto reconhecível. Campos recebidos: ${Object.keys(dados).join(", ")}`,
    );
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroGemini(`O Gemini devolveu algo que não é JSON: ${texto.slice(0, 200)}`);
  }
}

/**
 * Encontra o texto gerado na resposta.
 *
 * A forma abaixo foi observada numa chamada real, não deduzida da
 * documentação — e as duas divergem. Os SDKs expõem `output_text`, mas o
 * corpo REST não tem esse campo: ele traz `steps`, onde o primeiro passo
 * costuma ser do tipo "thought" (sem conteúdo) e o texto vive no passo
 * "model_output".
 *
 * Resposta real, encurtada:
 *   { "status": "completed",
 *     "steps": [ { "type": "thought" },
 *                { "type": "model_output",
 *                  "content": [ { "type": "text", "text": "{ … }" } ] } ] }
 *
 * `output_text` continua sendo tentado primeiro: se um dia a API passar
 * a devolvê-lo, este código já aproveita sem precisar mudar.
 */
function extrairTexto(dados: Record<string, unknown>): string | null {
  if (typeof dados.output_text === "string" && dados.output_text.trim() !== "") {
    return dados.output_text;
  }

  const passos = dados.steps;
  if (Array.isArray(passos)) {
    // De trás para frente: o texto final é o último passo com conteúdo,
    // e passos de raciocínio vêm antes.
    for (let i = passos.length - 1; i >= 0; i -= 1) {
      const conteudo = (passos[i] as { content?: unknown })?.content;
      if (!Array.isArray(conteudo)) continue;
      for (const parte of conteudo) {
        const texto = (parte as { text?: unknown })?.text;
        if (typeof texto === "string" && texto.trim() !== "") return texto;
      }
    }
  }

  return null;
}
