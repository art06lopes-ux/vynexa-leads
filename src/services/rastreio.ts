/**
 * Rastreio de e-mail: pixel de abertura, link rastreado e descadastro.
 *
 * Cada envio ganha um token aleatório (não o id do banco). O link
 * rastreado carrega o destino E uma assinatura HMAC sobre token+destino:
 * sem a assinatura, `/api/t/c/<token>?u=` seria um redirecionador aberto
 * que qualquer um usaria para disfarçar link de phishing com o nosso
 * domínio.
 */

export function novoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes).toString("base64url");
}

async function chaveHmac(): Promise<CryptoKey> {
  const segredo = (process.env.SEGREDO_SESSAO ?? "").trim();
  if (segredo.length < 32) throw new Error("SEGREDO_SESSAO ausente: necessário para assinar links rastreados.");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`rastreio:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function assinar(token: string, url: string): Promise<string> {
  const assinatura = await crypto.subtle.sign("HMAC", await chaveHmac(), new TextEncoder().encode(`${token}\n${url}`));
  return Buffer.from(assinatura).subarray(0, 16).toString("base64url");
}

export async function assinaturaConfere(token: string, url: string, recebida: string): Promise<boolean> {
  const esperada = await assinar(token, url);
  if (esperada.length !== recebida.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i += 1) dif |= esperada.charCodeAt(i) ^ recebida.charCodeAt(i);
  return dif === 0;
}

/** Endereço público do app, para montar os links dos e-mails. */
export function urlBase(configurada?: string | null): string {
  const bruto =
    configurada?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "https://vynexa-leads.vercel.app";
  return bruto.replace(/\/+$/, "");
}

/** Os três endereços de rastreio de um envio. Só http(s) é rastreado. */
export async function linksDeRastreio(base: string, token: string): Promise<{
  pixel: string;
  descadastro: string;
  rastrearLink: (url: string) => Promise<string>;
}> {
  return {
    pixel: `${base}/api/t/a/${token}`,
    descadastro: `${base}/descadastro/${token}`,
    rastrearLink: async (url: string) => {
      if (!/^https?:\/\//i.test(url)) return url;
      const s = await assinar(token, url);
      return `${base}/api/t/c/${token}?u=${encodeURIComponent(url)}&s=${s}`;
    },
  };
}
