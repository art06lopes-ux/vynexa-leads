import { getBanco } from "@/db/cliente";
import { cifrar, decifrar } from "@/lib/cofre";

/**
 * OAuth do Google e envio pelo Gmail, pela API REST.
 *
 * Escopo mínimo: `gmail.send` e nada mais. A ferramenta não lê a caixa
 * de entrada, não lista contatos, não apaga nada — só envia. Pedir menos
 * é o que faz a tela de consentimento ser honesta e o dano de um
 * vazamento ser limitado.
 *
 * Endpoints conferidos na documentação em 2026-09-14:
 *   autorização  https://accounts.google.com/o/oauth2/v2/auth
 *   token        https://oauth2.googleapis.com/token
 *   envio        https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 */

const AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const ENVIO = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const PERFIL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const ESCOPOS = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class ErroGoogle extends Error {
  readonly temporario: boolean;
  constructor(mensagem: string, temporario = false) {
    super(mensagem);
    this.temporario = temporario;
  }
}

function credenciais(): { id: string; segredo: string } {
  const id = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const segredo = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!id || !segredo) {
    throw new ErroGoogle(
      "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET ausentes. Crie as credenciais OAuth no Google Cloud (gratuito). Ver docs/SETUP.md.",
    );
  }
  return { id, segredo };
}

export function urlDeCallback(origem: string): string {
  return `${origem}/api/google/callback`;
}

/** Monta a URL da tela de consentimento. */
export function urlDeAutorizacao(origem: string, estado: string): string {
  const { id } = credenciais();
  const url = new URL(AUTORIZACAO);
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", urlDeCallback(origem));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPOS.join(" "));
  // `offline` + `consent`: é o que garante o refresh_token na resposta.
  // Sem `consent`, o Google só o devolve na primeira autorização, e
  // reconectar depois deixaria a conta sem token de renovação.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", estado);
  return url.toString();
}

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const resposta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const dados = (await resposta.json()) as RespostaToken;
  if (!resposta.ok || !dados.access_token) {
    // `invalid_grant` é o token revogado pelo usuário no Google: erro de
    // configuração, não de momento. Os demais valem nova tentativa.
    const permanente = dados.error === "invalid_grant";
    throw new ErroGoogle(
      `Google recusou o token: ${dados.error_description ?? dados.error ?? resposta.status}`,
      !permanente,
    );
  }
  return dados;
}

/** Troca o código do callback por tokens e guarda a conta. */
export async function concluirConexao(origem: string, codigo: string): Promise<string> {
  const { id, segredo } = credenciais();

  const tokens = await pedirToken({
    code: codigo,
    client_id: id,
    client_secret: segredo,
    redirect_uri: urlDeCallback(origem),
    grant_type: "authorization_code",
  });

  if (!tokens.refresh_token) {
    throw new ErroGoogle(
      "O Google não devolveu refresh_token. Revogue o acesso em myaccount.google.com/permissions e conecte de novo.",
    );
  }

  const perfil = await fetch(PERFIL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const { email } = (await perfil.json()) as { email?: string };
  if (!email) throw new ErroGoogle("Não consegui ler o e-mail da conta conectada.");

  await getBanco().execute({
    sql: `INSERT INTO contas_google (id, email, refresh_token_cifrado, escopos, conectado_em, ultimo_erro)
          VALUES (1, ?, ?, ?, datetime('now'), NULL)
          ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            refresh_token_cifrado = excluded.refresh_token_cifrado,
            escopos = excluded.escopos,
            conectado_em = excluded.conectado_em,
            ultimo_erro = NULL`,
    args: [email, await cifrar(tokens.refresh_token), tokens.scope ?? ESCOPOS.join(" ")],
  });

  return email;
}

export async function contaConectada(): Promise<{ email: string; conectadoEm: string; ultimoErro: string | null } | null> {
  const { rows } = await getBanco().execute(
    `SELECT email, conectado_em, ultimo_erro FROM contas_google WHERE id = 1`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    email: String(r.email),
    conectadoEm: String(r.conectado_em),
    ultimoErro: r.ultimo_erro ? String(r.ultimo_erro) : null,
  };
}

export async function desconectar(): Promise<void> {
  await getBanco().execute(`DELETE FROM contas_google WHERE id = 1`);
}

/** Access token novo a partir do refresh token guardado. */
async function accessToken(): Promise<string> {
  const { id, segredo } = credenciais();
  const { rows } = await getBanco().execute(`SELECT refresh_token_cifrado FROM contas_google WHERE id = 1`);
  const cifrado = rows[0]?.refresh_token_cifrado;
  if (!cifrado) throw new ErroGoogle("Nenhuma conta Google conectada. Conecte em Ajustes.");

  const tokens = await pedirToken({
    refresh_token: await decifrar(String(cifrado)),
    client_id: id,
    client_secret: segredo,
    grant_type: "refresh_token",
  });
  return tokens.access_token!;
}

/** Codifica para o `raw` do Gmail: base64url, sem `=` no fim. */
function base64url(texto: string): string {
  return Buffer.from(texto, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Assunto com acento precisa de RFC 2047; sem isso chega como "??". */
function assuntoCodificado(assunto: string): string {
  return `=?UTF-8?B?${Buffer.from(assunto, "utf8").toString("base64")}?=`;
}

export async function enviarEmail(entrada: {
  para: string;
  assunto: string;
  corpo: string;
  remetenteNome?: string;
}): Promise<string> {
  const token = await accessToken();

  const { rows } = await getBanco().execute(`SELECT email FROM contas_google WHERE id = 1`);
  const de = String(rows[0]?.email ?? "");

  // Texto puro de propósito. E-mail de primeira abordagem em HTML cheio
  // de imagem cai em promoção; texto simples de uma pessoa para outra é
  // o que chega na caixa de entrada.
  const mensagem = [
    `From: ${entrada.remetenteNome ? `${assuntoCodificado(entrada.remetenteNome)} <${de}>` : de}`,
    `To: ${entrada.para}`,
    `Subject: ${assuntoCodificado(entrada.assunto)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    entrada.corpo,
  ].join("\r\n");

  const resposta = await fetch(ENVIO, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64url(mensagem) }),
    signal: AbortSignal.timeout(30_000),
  });

  const dados = (await resposta.json()) as { id?: string; error?: { message?: string; code?: number } };

  if (!resposta.ok || !dados.id) {
    // 429 e 5xx: cota do dia ou instabilidade. Vale esperar e tentar.
    const temporario = resposta.status === 429 || resposta.status >= 500;
    throw new ErroGoogle(`Gmail recusou o envio: ${dados.error?.message ?? resposta.status}`, temporario);
  }

  return dados.id;
}
