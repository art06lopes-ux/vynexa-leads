import { agora, getBanco } from "@/db/cliente";
import { cifrar, decifrar } from "@/lib/cofre";

/**
 * Chaves de API configuráveis pela tela de Configurações.
 *
 * Ordem de leitura: (1) o valor salvo pela tela, cifrado no banco com
 * AES-GCM (`src/lib/cofre.ts`), e (2) a variável de ambiente de mesmo
 * nome. A tela nunca recebe o valor de volta — só se está configurado,
 * de onde veio e os quatro últimos caracteres, para o operador conferir
 * qual chave está em uso.
 *
 * Sem `server-only`: o worker do GitHub Actions também lê daqui (ele tem
 * o SEGREDO_SESSAO para decifrar). Nada deste módulo é importado por
 * componente de cliente — quem garante é o `import "server-only"` das
 * rotas e ações que o usam.
 */

export const SEGREDOS = {
  GOOGLE_PLACES_API_KEY: { rotulo: "Google Places API", grupo: "google" },
  GEMINI_API_KEY: { rotulo: "Gemini (IA)", grupo: "ia" },
  RESEND_API_KEY: { rotulo: "Resend", grupo: "email" },
  RESEND_WEBHOOK_SECRET: { rotulo: "Segredo do webhook do Resend", grupo: "email" },
  SMTP_PASSWORD: { rotulo: "Senha SMTP", grupo: "email" },
  ASAAS_API_KEY: { rotulo: "Asaas", grupo: "pagamento" },
  ASAAS_WEBHOOK_TOKEN: { rotulo: "Token do webhook do Asaas", grupo: "pagamento" },
} as const;

export type NomeSegredo = keyof typeof SEGREDOS;

export function ehNomeSegredo(nome: string): nome is NomeSegredo {
  return Object.hasOwn(SEGREDOS, nome);
}

/** Cache curto por processo: a mesma chave é lida várias vezes num job. */
const cache = new Map<NomeSegredo, { valor: string | null; ate: number }>();
const CACHE_MS = 30_000;

export async function obterSegredo(nome: NomeSegredo): Promise<string | null> {
  const emCache = cache.get(nome);
  if (emCache && emCache.ate > Date.now()) return emCache.valor;

  let valor: string | null = null;
  try {
    const { rows } = await getBanco().execute({
      sql: `SELECT valor_cifrado FROM integracoes WHERE chave = ?`,
      args: [nome],
    });
    if (rows[0]) valor = await decifrar(String(rows[0].valor_cifrado));
  } catch {
    // Tabela ausente (banco antes da 0012) ou segredo trocado: cai no env.
    valor = null;
  }
  if (!valor) {
    const env = (process.env[nome] ?? "").trim();
    valor = env === "" ? null : env;
  }

  cache.set(nome, { valor, ate: Date.now() + CACHE_MS });
  return valor;
}

export async function salvarSegredo(nome: NomeSegredo, valor: string): Promise<void> {
  const limpo = valor.trim();
  if (limpo.length < 8) throw new Error("Valor curto demais para ser uma chave de API.");
  await getBanco().execute({
    sql: `INSERT INTO integracoes (chave, valor_cifrado, final, atualizado_em) VALUES (?, ?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor_cifrado = excluded.valor_cifrado, final = excluded.final,
                                           atualizado_em = excluded.atualizado_em`,
    args: [nome, await cifrar(limpo), limpo.slice(-4), agora()],
  });
  cache.delete(nome);
}

export async function removerSegredo(nome: NomeSegredo): Promise<void> {
  await getBanco().execute({ sql: `DELETE FROM integracoes WHERE chave = ?`, args: [nome] });
  cache.delete(nome);
}

export type EstadoSegredo = {
  nome: NomeSegredo;
  rotulo: string;
  grupo: string;
  configurado: boolean;
  origem: "tela" | "ambiente" | null;
  final: string | null;
  atualizadoEm: string | null;
};

/** O que a tela pode saber: nunca o valor. */
export async function estadoDosSegredos(): Promise<EstadoSegredo[]> {
  let salvos = new Map<string, { final: string | null; atualizado_em: string }>();
  try {
    const { rows } = await getBanco().execute(`SELECT chave, final, atualizado_em FROM integracoes`);
    salvos = new Map(rows.map((r) => [String(r.chave), { final: r.final ? String(r.final) : null, atualizado_em: String(r.atualizado_em) }]));
  } catch {
    // banco antigo
  }

  return (Object.keys(SEGREDOS) as NomeSegredo[]).map((nome) => {
    const salvo = salvos.get(nome);
    const env = (process.env[nome] ?? "").trim();
    return {
      nome,
      rotulo: SEGREDOS[nome].rotulo,
      grupo: SEGREDOS[nome].grupo,
      configurado: Boolean(salvo) || env !== "",
      origem: salvo ? "tela" : env !== "" ? "ambiente" : null,
      final: salvo?.final ?? (env !== "" ? env.slice(-4) : null),
      atualizadoEm: salvo?.atualizado_em ?? null,
    };
  });
}
