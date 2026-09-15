import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";
import { getOsmUserAgent } from "@/lib/ambiente";
import { extrairDominio } from "@/lib/leads/classificacao";

export type PayloadEnriquecer = { limite: number };

/**
 * Procura e-mail no site da própria empresa.
 *
 * É a única fonte além do OpenStreetMap que a especificação autoriza:
 * "o conteúdo público do próprio site da empresa, se existir e o
 * robots.txt permitir". Vale para qualquer país — é de onde sai o e-mail
 * das empresas internacionais, que raramente têm `contact:email` no OSM.
 *
 * Regras que este código cumpre à risca:
 * - Lê o robots.txt antes. Se `Disallow: /` para todos, não entra.
 * - Visita só a página inicial e, no máximo, uma página de contato
 *   linkada nela. Nada de rastrear o site.
 * - Um site por vez, com identificação no User-Agent.
 * - Nunca inventa: se não há e-mail no HTML, o campo fica nulo.
 * - Marca `site_verificado_em` mesmo sem achar, para não voltar lá.
 */

const TETO_POR_JOB = 15;
const ORCAMENTO_MS = 3 * 60 * 1000;

/** E-mails que aparecem em todo site e não são da empresa. */
const IGNORAR = /(example\.com|sentry\.io|wixpress|w3\.org|schema\.org|googleapis|\.png$|\.jpg$|\.svg$|\.webp$|noreply|no-reply|donotreply)/i;

const REGEX_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export async function processarEnriquecimento(banco: Client, payload: PayloadEnriquecer): Promise<string> {
  const limite = Math.min(Math.max(payload.limite, 1), TETO_POR_JOB);
  const inicio = Date.now();

  const { rows } = await banco.execute({
    sql: `SELECT id, website FROM empresas
          WHERE website IS NOT NULL AND website <> ''
            AND (email IS NULL OR email = '')
            AND site_verificado_em IS NULL
            AND status_site = 'tem_site'
          ORDER BY criado_em DESC LIMIT ?`,
    args: [limite],
  });

  let achados = 0;
  let visitados = 0;

  for (const r of rows) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    const id = String(r.id);
    const site = String(r.website);
    visitados += 1;

    const email = await procurarEmail(site).catch(() => null);

    await banco.execute({
      sql: `UPDATE empresas
            SET email = COALESCE(?, email),
                email_origem = CASE WHEN ? IS NOT NULL THEN 'site' ELSE email_origem END,
                site_verificado_em = ?,
                atualizado_em = ?
            WHERE id = ?`,
      args: [email, email, agora(), agora(), id],
    });

    if (email) achados += 1;
  }

  const { rows: restantes } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas
     WHERE website IS NOT NULL AND website <> '' AND (email IS NULL OR email = '')
       AND site_verificado_em IS NULL AND status_site = 'tem_site'`,
  );
  const faltam = Number(restantes[0]?.n ?? 0);

  // Continua sozinho enquanto houver site por visitar.
  if (faltam > 0 && visitados > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'enriquecer_email', ?, 'pendente')`,
      args: [crypto.randomUUID(), JSON.stringify({ limite: TETO_POR_JOB })],
    });
  }

  return `${visitados} site(s) visitado(s), ${achados} e-mail(s) encontrado(s), ${faltam} restante(s)`;
}

function normalizarUrl(site: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
  } catch {
    return null;
  }
}

/**
 * Confere se o robots.txt permite a página inicial para robôs genéricos.
 *
 * Leitura conservadora: qualquer `Disallow: /` no bloco `User-agent: *`
 * fecha a porta. Não tenta ser esperto com regras parciais — na dúvida,
 * não entra. Sem robots.txt (404), a convenção é que pode.
 */
async function robotsPermite(base: URL): Promise<boolean> {
  try {
    const r = await fetch(new URL("/robots.txt", base), {
      headers: { "User-Agent": getOsmUserAgent() },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (r.status === 404) return true;
    if (!r.ok) return false;

    const texto = (await r.text()).slice(0, 20_000);
    let bloco = false;
    for (const linha of texto.split(/\r?\n/)) {
      const l = linha.trim().toLowerCase();
      if (l.startsWith("user-agent:")) bloco = l.includes("*");
      else if (bloco && /^disallow:\s*\/\s*$/.test(l)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function baixar(url: URL): Promise<string | null> {
  const r = await fetch(url, {
    headers: { "User-Agent": getOsmUserAgent(), Accept: "text/html" },
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
  if (!r.ok) return null;
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("text/html")) return null;
  // 1,5 MB: sites em Wix e afins passam de 1 MB só de HTML, e o e-mail
  // costuma estar no rodapé — no fim. Ainda é um teto, não o site inteiro.
  return (await r.text()).slice(0, 1_500_000);
}

function extrairEmails(html: string, dominio: string | null): string[] {
  const candidatos = new Set<string>();

  // mailto: é o sinal mais confiável.
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) candidatos.add(m[1]!.toLowerCase());
  for (const m of html.matchAll(REGEX_EMAIL)) candidatos.add(m[0].toLowerCase());

  const lista = [...candidatos].filter((e) => !IGNORAR.test(e) && e.length < 80);

  // Prefere e-mail no domínio do próprio site: "contato@barbearia.com"
  // vale mais que o gmail de quem fez o site.
  return lista.sort((a, b) => {
    const pa = dominio && a.endsWith(`@${dominio}`) ? 0 : 1;
    const pb = dominio && b.endsWith(`@${dominio}`) ? 0 : 1;
    return pa - pb;
  });
}

async function procurarEmail(site: string): Promise<string | null> {
  const base = normalizarUrl(site);
  if (!base) return null;
  if (!(await robotsPermite(base))) return null;

  const dominio = extrairDominio(site);
  const home = await baixar(base);
  if (!home) return null;

  const naHome = extrairEmails(home, dominio);
  if (naHome.length > 0) return naHome[0]!;

  // Uma página de contato, se a home linkar para ela. Só uma.
  const link = home.match(/href=["']([^"']*(contato|contact|fale-conosco|kontakt|contacto)[^"']*)["']/i)?.[1];
  if (!link) return null;

  try {
    const contato = await baixar(new URL(link, base));
    if (!contato) return null;
    return extrairEmails(contato, dominio)[0] ?? null;
  } catch {
    return null;
  }
}
