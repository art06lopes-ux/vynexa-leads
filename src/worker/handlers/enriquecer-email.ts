import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";
import { getOsmUserAgent } from "@/lib/ambiente";
import { ehRedeSocial, extrairDominio } from "@/lib/leads/classificacao";

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

/**
 * Provedores de e-mail pessoal. Um e-mail neles não diz nada sobre site;
 * um e-mail fora deles aponta um domínio que PODE ser o site da empresa
 * — e isso se confere visitando, não se presume.
 */
const PROVEDORES_PESSOAIS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "outlook.com.br", "hotmail.com.br", "live.com",
  "yahoo.com", "yahoo.com.br", "ymail.com", "icloud.com", "me.com", "msn.com", "aol.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com",
  "oi.com.br", "zipmail.com.br", "r7.com", "protonmail.com", "proton.me", "mail.com",
]);

export async function processarEnriquecimento(banco: Client, payload: PayloadEnriquecer): Promise<string> {
  const limite = Math.min(Math.max(payload.limite, 1), TETO_POR_JOB);
  const inicio = Date.now();

  const { rows } = await banco.execute({
    sql: `SELECT id, website FROM empresas
          WHERE website IS NOT NULL AND website <> ''
            AND (email IS NULL OR email = '' OR instagram IS NULL)
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

    const achado = await procurarNoSite(site).catch(() => ({ email: null, instagram: null, facebook: null }));

    await banco.execute({
      sql: `UPDATE empresas
            SET email = COALESCE(email, ?),
                email_origem = CASE WHEN email IS NULL AND ? IS NOT NULL THEN 'site' ELSE email_origem END,
                instagram = COALESCE(instagram, ?),
                facebook = COALESCE(facebook, ?),
                site_verificado_em = ?,
                atualizado_em = ?
            WHERE id = ?`,
      args: [achado.email, achado.email, achado.instagram, achado.facebook, agora(), agora(), id],
    });

    if (achado.email) achados += 1;
  }

  // Segunda passada: empresas da Receita cujo e-mail está num domínio
  // próprio. Se o domínio serve uma página, é o site da empresa — e só
  // então a linha ganha `website` e muda de "sem site" para "tem site".
  const dominios = await verificarDominiosDeEmail(banco, limite, inicio);

  const { rows: restantes } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas
     WHERE website IS NOT NULL AND website <> '' AND (email IS NULL OR email = '' OR instagram IS NULL)
       AND site_verificado_em IS NULL AND status_site = 'tem_site'`,
  );
  const faltam = Number(restantes[0]?.n ?? 0);

  // Continua sozinho enquanto houver site por visitar.
  if ((faltam > 0 && visitados > 0) || (dominios.restantes > 0 && dominios.verificados > 0)) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'enriquecer_email', ?, 'pendente')`,
      args: [crypto.randomUUID(), JSON.stringify({ limite: TETO_POR_JOB })],
    });
  }

  return `${visitados} site(s) visitado(s), ${achados} e-mail(s) encontrado(s), ${dominios.verificados} domínio(s) de e-mail conferido(s) (${dominios.comSite} com site), ${faltam} restante(s)`;
}

async function verificarDominiosDeEmail(
  banco: Client,
  limite: number,
  inicio: number,
): Promise<{ verificados: number; comSite: number; restantes: number }> {
  const { rows } = await banco.execute({
    sql: `SELECT id, email FROM empresas
          WHERE email_origem = 'receita' AND (website IS NULL OR website = '')
            AND site_verificado_em IS NULL
          ORDER BY criado_em DESC LIMIT ?`,
    args: [limite * 2],
  });

  let verificados = 0;
  let comSite = 0;

  for (const r of rows) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    const id = String(r.id);
    const dominio = String(r.email).split("@")[1]?.toLowerCase() ?? "";

    if (!dominio || PROVEDORES_PESSOAIS.has(dominio)) {
      // Nada a conferir: e-mail pessoal não aponta site. Marca como
      // verificado para não voltar aqui.
      await banco.execute({
        sql: `UPDATE empresas SET site_verificado_em = ? WHERE id = ?`,
        args: [agora(), id],
      });
      continue;
    }

    verificados += 1;
    const site = await dominioServePagina(dominio).catch(() => null);
    const status = site ? (ehRedeSocial(site) ? "rede_social" : "tem_site") : null;
    if (site) comSite += 1;

    await banco.execute({
      sql: `UPDATE empresas
            SET website = COALESCE(?, website),
                status_site = COALESCE(?, status_site),
                site_verificado_em = ?,
                atualizado_em = ?
            WHERE id = ?`,
      args: [site, status, agora(), agora(), id],
    });
  }

  const { rows: sobra } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas
     WHERE email_origem = 'receita' AND (website IS NULL OR website = '') AND site_verificado_em IS NULL`,
  );
  return { verificados, comSite, restantes: Number(sobra[0]?.n ?? 0) };
}

/** A URL final se o domínio responde HTML; nulo se não responde. */
async function dominioServePagina(dominio: string): Promise<string | null> {
  for (const url of [`https://${dominio}`, `https://www.${dominio}`]) {
    try {
      // A mesma regra da coleta de e-mail: robots.txt manda. Um domínio
      // que serve um robots.txt fechado tem site — só não entramos nele.
      // Domínio que nem responde ao robots.txt cai no catch: não há site.
      const base = new URL(url);
      const robots = await fetch(new URL("/robots.txt", base), {
        headers: { "User-Agent": getOsmUserAgent() },
        signal: AbortSignal.timeout(8_000),
        redirect: "follow",
      });
      if (robots.ok && !(await robotsPermite(base))) return url;

      const r = await fetch(url, {
        headers: { "User-Agent": getOsmUserAgent(), Accept: "text/html" },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      if (!r.ok) continue;
      if (!(r.headers.get("content-type") ?? "").includes("text/html")) continue;
      // Página de domínio estacionado é HTML, mas não é site. Os
      // registradores grandes anunciam isso no título.
      const inicio = (await r.text()).slice(0, 20_000);
      if (/domain (is )?(for sale|parked)|sedoparking|parkingcrew|\/parked/i.test(inicio)) continue;
      return r.url;
    } catch {
      continue;
    }
  }
  return null;
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

type AchadoNoSite = { email: string | null; instagram: string | null; facebook: string | null };

/**
 * Perfis de rede social linkados no site da própria empresa.
 *
 * É a única forma permitida de chegar ao Instagram: o link que a
 * empresa colocou na sua página. A ferramenta não visita o Instagram
 * nem o Facebook — só guarda o endereço do perfil.
 */
function extrairRedes(html: string): { instagram: string | null; facebook: string | null } {
  const insta = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,30})\/?["'?#\s<]/i);
  const face = html.match(/https?:\/\/(?:www\.|m\.)?facebook\.com\/([A-Za-z0-9_.\-]{3,60})\/?["'?#\s<]/i);
  const IGNORAR_INSTA = new Set(["p", "explore", "accounts", "reel", "reels", "stories", "share", "developer"]);
  const IGNORAR_FACE = new Set(["sharer", "share", "sharer.php", "dialog", "plugins", "login", "tr", "policies", "help"]);
  const i = insta?.[1] && !IGNORAR_INSTA.has(insta[1].toLowerCase()) ? `https://instagram.com/${insta[1]}` : null;
  const f = face?.[1] && !IGNORAR_FACE.has(face[1].toLowerCase()) ? `https://facebook.com/${face[1]}` : null;
  return { instagram: i, facebook: f };
}

async function procurarNoSite(site: string): Promise<AchadoNoSite> {
  const nada: AchadoNoSite = { email: null, instagram: null, facebook: null };
  const base = normalizarUrl(site);
  if (!base) return nada;
  if (!(await robotsPermite(base))) return nada;

  const dominio = extrairDominio(site);
  const home = await baixar(base);
  if (!home) return nada;

  const redes = extrairRedes(home);
  const naHome = extrairEmails(home, dominio);
  if (naHome.length > 0) return { email: naHome[0]!, ...redes };

  // Uma página de contato, se a home linkar para ela. Só uma.
  const link = home.match(/href=["']([^"']*(contato|contact|fale-conosco|kontakt|contacto)[^"']*)["']/i)?.[1];
  if (!link) return { email: null, ...redes };

  try {
    const contato = await baixar(new URL(link, base));
    if (!contato) return { email: null, ...redes };
    const redesContato = extrairRedes(contato);
    return {
      email: extrairEmails(contato, dominio)[0] ?? null,
      instagram: redes.instagram ?? redesContato.instagram,
      facebook: redes.facebook ?? redesContato.facebook,
    };
  } catch {
    return { email: null, ...redes };
  }
}
