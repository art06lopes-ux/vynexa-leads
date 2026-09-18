import { createClient, type Client, type InStatement, type ResultSet, type Row } from "@libsql/client";

/**
 * Cliente do banco.
 *
 * Em desenvolvimento, `TURSO_DATABASE_URL=file:./local.db` faz tudo
 * rodar contra um arquivo SQLite local — sem conta em serviço nenhum.
 *
 * Em produção, o banco é o Cloudflare D1: mesmo motor (SQLite), acessado
 * pela API REST da Cloudflare em vez de um binding de Worker, porque o
 * app roda na Vercel, não em Cloudflare Workers. `clienteD1()` implementa
 * só os métodos que o resto do código usa (`execute`, `batch`,
 * `executeMultiple`, `transaction`) por cima dessa API.
 *
 * A troca veio do Turso: o plano gratuito bloqueia a conta inteira ao
 * bater a cota MENSAL de linhas lidas (500 milhões), sem reset até o
 * próximo ciclo — e a caçada "Brasil inteiro" passa disso fácil. O D1
 * gratuito tem cota DIÁRIA (5 milhões de linhas lidas, 100 mil escritas,
 * resetando à meia-noite UTC) e não pede cartão: uma batida ruim custa
 * um dia bloqueado, não o mês inteiro.
 *
 * O teto de 100 parâmetros por statement do D1 (bem menor que os 999 do
 * SQLite puro) é outra diferença real, não só de cota — todo `IN (...)`
 * ou `INSERT` com lista de tamanho variável neste projeto precisa
 * respeitar isso. Ver `MAX_PARAMETROS_D1` em `src/worker/receita/importar.ts`
 * e os lotes de 100 em `cnpjsConhecidos`, `osmIdsConhecidos` e
 * `nichosPorRegiao`.
 */

let cache: Client | null = null;

/**
 * Copia uma linha do libSQL para um objeto simples.
 *
 * As linhas que o cliente devolve carregam índice numérico e `length`
 * além das colunas — é um objeto "parecido com array". O React se recusa
 * a mandar isso de Server Component para Client Component ("Only plain
 * objects can be passed") e, em produção, derruba a tela. Espalhar copia
 * só as colunas, que é o que a interface precisa.
 */
export function plano<T>(linha: unknown): T {
  return { ...(linha as object) } as T;
}

export function planos<T>(linhas: ArrayLike<unknown>): T[] {
  return Array.from(linhas, (l) => plano<T>(l));
}

/**
 * Remove TODO espaço em branco, não só nas pontas.
 *
 * `trim()` sozinho não bastava: colar uma credencial de um campo que
 * quebra linha traz uma quebra no meio do valor, e nem a URL nem o token
 * do Turso podem conter espaço em lugar nenhum.
 */
function limpar(valor: string | undefined): string {
  return (valor ?? "").replace(/\s+/g, "");
}

type EntradaD1 = { sql: string; args?: unknown[] | Record<string, unknown> };

function normalizarEntrada(entrada: InStatement): { sql: string; params: unknown[] } {
  if (typeof entrada === "string") return { sql: entrada, params: [] };
  const e = entrada as EntradaD1;
  return { sql: e.sql, params: Array.isArray(e.args) ? e.args : [] };
}

/**
 * Cliente do Cloudflare D1 pela API REST.
 *
 * Implementa só o subconjunto do `Client` do libSQL que o resto do app
 * usa. Não é o `Client` inteiro (não tem `.sync()`, `.close()` etc.) —
 * por isso o cast `as unknown as Client` em `getBanco()`.
 */
function clienteD1(accountId: string, databaseId: string, apiToken: string): Client {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  async function chamar(corpo: Record<string, unknown>): Promise<Array<{ results: Row[]; meta: { rows_written: number; last_row_id: number; changes: number } }>> {
    const resposta = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    const corpoResposta = (await resposta.json()) as {
      success: boolean;
      result?: Array<{ results: Row[]; meta: { rows_written: number; last_row_id: number; changes: number } }>;
      errors?: Array<{ code: number; message: string }>;
    };

    if (!resposta.ok || !corpoResposta.success) {
      const motivo = corpoResposta.errors?.map((e) => e.message).join("; ") || resposta.statusText;
      throw new Error(`D1: ${motivo}`);
    }

    return corpoResposta.result ?? [];
  }

  function paraResultSet(r: { results: Row[]; meta: { rows_written: number; last_row_id: number; changes: number } }): ResultSet {
    return {
      rows: r.results,
      columns: r.results[0] ? Object.keys(r.results[0]) : [],
      columnTypes: [],
      rowsAffected: r.meta.changes,
      lastInsertRowid: r.meta.last_row_id ? BigInt(r.meta.last_row_id) : undefined,
      toJSON() {
        return this;
      },
    } as unknown as ResultSet;
  }

  async function execute(entrada: InStatement): Promise<ResultSet> {
    const { sql, params } = normalizarEntrada(entrada);
    const [r] = await chamar({ sql, params });
    return paraResultSet(r);
  }

  async function batch(entradas: InStatement[]): Promise<ResultSet[]> {
    if (entradas.length === 0) return [];
    const corpo = { batch: entradas.map(normalizarEntrada) };
    const resultados = await chamar(corpo);
    return resultados.map(paraResultSet);
  }

  return {
    execute,
    batch,
    async executeMultiple(sql: string) {
      // D1 roda várias sentenças separadas por `;` num único `sql`, em
      // sequência — é o que sustenta as migrações, que não têm parâmetro.
      await chamar({ sql });
    },
    async transaction() {
      // A API REST do D1 não tem transação interativa (várias chamadas
      // HTTP presas numa mesma transação): o que existe é `batch`, que
      // roda tudo de uma vez de forma atômica. Por isso esta "transação"
      // só acumula as instruções e as manda juntas no `commit()` — igual
      // ao `batch()` de cima, com a cara de transação que o chamador
      // espera. Não serve para quem precisa ler o resultado de uma
      // instrução antes de montar a próxima dentro da mesma transação.
      const pendentes: InStatement[] = [];
      return {
        async execute(entrada: InStatement) {
          pendentes.push(entrada);
          return paraResultSet({ results: [], meta: { rows_written: 0, last_row_id: 0, changes: 0 } });
        },
        async commit() {
          await batch(pendentes);
        },
        async rollback() {
          pendentes.length = 0;
        },
        async close() {},
        closed: false,
      };
    },
  } as unknown as Client;
}

export function getBanco(): Client {
  if (cache !== null) return cache;

  const accountId = limpar(process.env.CLOUDFLARE_ACCOUNT_ID);
  const databaseId = limpar(process.env.CLOUDFLARE_D1_DATABASE_ID);
  const apiToken = limpar(process.env.CLOUDFLARE_API_TOKEN);

  if (accountId && databaseId && apiToken) {
    cache = clienteD1(accountId, databaseId, apiToken);
    return cache;
  }

  // Sem credencial do D1: modo local, contra arquivo SQLite. Mesmo motor
  // do D1 — o que funciona no arquivo funciona lá.
  const url = limpar(process.env.TURSO_DATABASE_URL);
  if (!url) {
    throw new Error(
      "Nem CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_D1_DATABASE_ID/CLOUDFLARE_API_TOKEN nem TURSO_DATABASE_URL " +
        "estão definidos. Copie .env.example para .env.local. Para rodar local sem conta em serviço " +
        "nenhum, use TURSO_DATABASE_URL=file:./local.db. Ver docs/SETUP.md.",
    );
  }
  if (!url.startsWith("file:")) {
    throw new Error(
      "TURSO_DATABASE_URL aponta para um banco remoto, mas o projeto migrou para o Cloudflare D1. " +
        "Defina CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID e CLOUDFLARE_API_TOKEN, ou use " +
        "TURSO_DATABASE_URL=file:./local.db para rodar local. Ver docs/SETUP.md.",
    );
  }

  cache = createClient({ url });
  return cache;
}

/** Identificador de linha. `crypto.randomUUID` existe no Node 20+ e na Vercel. */
export function novoId(): string {
  return crypto.randomUUID();
}

/** Instante atual no mesmo formato que o `datetime('now')` do SQLite. */
export function agora(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
