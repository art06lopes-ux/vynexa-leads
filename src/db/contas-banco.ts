import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { createClient, type Client } from "@libsql/client";

import { clienteD1, getBancoPrincipal } from "@/db/cliente";
import { ESQUEMA_CONTA, MIGRACOES_INCLUIDAS } from "@/db/esquema-conta";
import { lerSessao, NOME_COOKIE } from "@/lib/auth";

/**
 * Qual banco atende cada conta.
 *
 * A conta do dono (`CONTA_PRINCIPAL`) usa o banco principal — o mesmo de
 * sempre, que também guarda as tabelas de controle do SaaS. Cada
 * assinante ganha um banco próprio no cadastro: no Cloudflare D1 em
 * produção, num arquivo SQLite local em desenvolvimento.
 */

export const CONTA_PRINCIPAL = "principal";

const contexto = new AsyncLocalStorage<string>();

/** Roda `fn` com o banco da conta `contaId` (worker, webhooks, tarefas do admin). */
export function comConta<T>(contaId: string, fn: () => Promise<T>): Promise<T> {
  return contexto.run(contaId, fn);
}

/** A conta da execução atual: a do contexto, senão a do cookie de sessão. `null` = principal. */
export async function contaDoContexto(): Promise<string | null> {
  const doContexto = contexto.getStore();
  if (doContexto) return doContexto === CONTA_PRINCIPAL ? null : doContexto;
  try {
    const { cookies } = await import("next/headers");
    const sessao = await lerSessao((await cookies()).get(NOME_COOKIE)?.value);
    return sessao && sessao.conta !== CONTA_PRINCIPAL ? sessao.conta : null;
  } catch {
    // Fora de uma requisição (worker, script, teste): banco principal.
    return null;
  }
}

type RefBanco = { tipo: string; ref: string | null };

const clientes = new Map<string, Client>();
const refs = new Map<string, { valor: RefBanco; ate: number }>();

async function refDaConta(contaId: string): Promise<RefBanco> {
  const emCache = refs.get(contaId);
  if (emCache && emCache.ate > Date.now()) return emCache.valor;
  const { rows } = await getBancoPrincipal().execute({ sql: `SELECT banco_tipo, banco_ref FROM contas WHERE id = ?`, args: [contaId] });
  if (!rows[0]) throw new Error("Conta não encontrada. Entre de novo.");
  const valor = { tipo: String(rows[0].banco_tipo), ref: rows[0].banco_ref ? String(rows[0].banco_ref) : null };
  refs.set(contaId, { valor, ate: Date.now() + 5 * 60_000 });
  return valor;
}

function credenciaisD1() {
  const limpar = (v: string | undefined) => (v ?? "").replace(/\s+/g, "");
  const accountId = limpar(process.env.CLOUDFLARE_ACCOUNT_ID);
  const apiToken = limpar(process.env.CLOUDFLARE_API_TOKEN);
  return accountId && apiToken ? { accountId, apiToken } : null;
}

function caminhoLocal(contaId: string): string {
  const pasta = join(process.cwd(), "dados", "contas");
  mkdirSync(pasta, { recursive: true });
  return `file:${join(pasta, `${contaId.replace(/[^a-z0-9-]/gi, "")}.db`).replace(/\\/g, "/")}`;
}

function clienteDaRef(contaId: string, r: RefBanco): Client {
  if (r.tipo === "principal") return getBancoPrincipal();
  if (r.tipo === "d1") {
    const cred = credenciaisD1();
    if (!cred || !r.ref) throw new Error("Banco da conta indisponível (credenciais do Cloudflare ausentes).");
    return clienteD1(cred.accountId, r.ref, cred.apiToken);
  }
  if (r.tipo === "arquivo") return createClient({ url: r.ref ?? caminhoLocal(contaId) });
  throw new Error("O banco desta conta ainda não foi criado. Fale com o suporte.");
}

export async function resolverBancoDaConta(contaId: string): Promise<Client> {
  const pronto = clientes.get(contaId);
  if (pronto) return pronto;
  const cliente = clienteDaRef(contaId, await refDaConta(contaId));
  clientes.set(contaId, cliente);
  // Migrações automáticas que entraram depois do cadastro desta conta.
  const { garantirEsquema } = await import("@/db/esquema-auto");
  await garantirEsquema(cliente, { principal: false });
  return cliente;
}

/** Esquecer o que está em memória sobre a conta (depois de mudar o banco dela). */
export function esquecerConta(contaId: string): void {
  clientes.delete(contaId);
  refs.delete(contaId);
}

/** Aplica o esquema inteiro num banco vazio e marca as migrações como feitas. */
export async function aplicarEsquemaConta(banco: Client): Promise<void> {
  const tudo = [
    ...ESQUEMA_CONTA,
    `CREATE TABLE IF NOT EXISTS migracoes_aplicadas (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL DEFAULT (datetime('now')))`,
  ];
  // Em lotes: o D1 aceita batch grande, mas cada chamada tem 30 s.
  for (let i = 0; i < tudo.length; i += 40) await banco.batch(tudo.slice(i, i + 40), "write");
  for (let i = 0; i < MIGRACOES_INCLUIDAS.length; i += 50) {
    const lote = MIGRACOES_INCLUIDAS.slice(i, i + 50);
    await banco.execute({ sql: `INSERT OR IGNORE INTO migracoes_aplicadas (nome) VALUES ${lote.map(() => "(?)").join(",")}`, args: lote });
  }
}

/**
 * Cria o banco de um assinante novo. Em produção, um D1 novo pela API
 * da Cloudflare (o token precisa da permissão "D1: Edit"); em
 * desenvolvimento, um arquivo em `dados/contas/`.
 */
export async function criarBancoDaConta(contaId: string): Promise<RefBanco> {
  const cred = credenciaisD1();
  let ref: RefBanco;
  if (cred && process.env.CLOUDFLARE_D1_DATABASE_ID) {
    const resposta = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cred.accountId}/d1/database`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `vynexa-conta-${contaId.slice(0, 18)}` }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { success?: boolean; result?: { uuid?: string }; errors?: Array<{ message: string; code: number }> };
    if (!resposta.ok || !corpo.success || !corpo.result?.uuid) {
      const motivo = corpo.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${resposta.status}`;
      throw new Error(`Não foi possível criar o banco da conta no Cloudflare D1 (${motivo}).`);
    }
    ref = { tipo: "d1", ref: corpo.result.uuid };
  } else {
    ref = { tipo: "arquivo", ref: caminhoLocal(contaId) };
  }
  await aplicarEsquemaConta(clienteDaRef(contaId, ref));
  return ref;
}

/** Apaga o D1 de uma conta excluída. Só no D1; o arquivo local fica (é desenvolvimento). */
export async function apagarBancoDaConta(r: RefBanco): Promise<void> {
  const cred = credenciaisD1();
  if (r.tipo !== "d1" || !r.ref || !cred) return;
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${cred.accountId}/d1/database/${r.ref}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cred.apiToken}` },
  });
}

// ── Links públicos (e-mail aberto fora do painel, sem sessão) ──────────

/**
 * Prefixo que leva a conta junto do token nos links públicos (pixel,
 * clique, descadastro): `conta~token`. A conta do dono não leva prefixo,
 * então os e-mails antigos continuam funcionando.
 */
export async function tokenPublico(token: string): Promise<string> {
  const conta = await contaDoContexto();
  return conta ? `${conta}~${token}` : token;
}

export function separarTokenPublico(bruto: string): { conta: string; token: string } {
  const i = bruto.indexOf("~");
  if (i <= 0) return { conta: CONTA_PRINCIPAL, token: bruto };
  const conta = bruto.slice(0, i);
  return /^[a-z0-9-]{1,64}$/i.test(conta) ? { conta, token: bruto.slice(i + 1) } : { conta: CONTA_PRINCIPAL, token: "" };
}

/** Roda `fn` no banco da conta do token público; conta inexistente = nada. */
export async function comTokenPublico<T>(bruto: string, fn: (token: string) => Promise<T>, seFalhar: T): Promise<T> {
  const { conta, token } = separarTokenPublico(decodeURIComponent(bruto));
  if (!token) return seFalhar;
  try {
    return await comConta(conta, () => fn(token));
  } catch {
    return seFalhar;
  }
}
