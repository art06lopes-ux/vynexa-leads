import type { StatusSite } from "@/db/tipos";

/**
 * Domínios que são presença em plataforma de terceiro, não site próprio.
 *
 * A distinção é o coração da qualificação: quem só tem Instagram é um
 * lead melhor do que quem tem site, e a mensagem enviada é outra.
 */
const DOMINIOS_REDE_SOCIAL = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "m.me",
  "linktr.ee",
  "linktree.com",
  "beacons.ai",
  "bio.link",
  "linkbio.co",
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "yelp.com",
  "tripadvisor.com",
  // Construtores em que a empresa não tem domínio próprio. Tecnicamente
  // é um site; comercialmente é o mesmo caso, e dá para oferecer melhor.
  "wixsite.com",
  "blogspot.com",
  "wordpress.com",
  "webnode.page",
  "negocio.site",
  "business.site",
  "sites.google.com",
  "godaddysites.com",
  "squarespace.com",
];

/** Extrai o host de uma URL que pode vir sem esquema, como o OSM às vezes traz. */
export function extrairDominio(bruto: string | null | undefined): string | null {
  const texto = bruto?.trim();
  if (!texto) return null;

  const comEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    return new URL(comEsquema).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function ehRedeSocial(website: string | null | undefined): boolean {
  const dominio = extrairDominio(website);
  if (dominio === null) return false;
  return DOMINIOS_REDE_SOCIAL.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/**
 * Classifica a presença digital a partir do que a fonte trouxe.
 *
 * `sem_dado` vem primeiro de propósito. Sem nenhum contato e sem site, o
 * que temos é ausência de informação, não ausência de site — afirmar
 * "sem_site" aqui seria inventar um fato, que é justamente o que o
 * projeto proíbe.
 */
export function classificarStatusSite(entrada: {
  website: string | null | undefined;
  telefone: string | null | undefined;
  email?: string | null | undefined;
  instagram?: string | null | undefined;
  facebook?: string | null | undefined;
}): StatusSite {
  const site = entrada.website?.trim();
  const temContato = Boolean(entrada.telefone?.trim() || entrada.email?.trim());
  const temRede = Boolean(entrada.instagram?.trim() || entrada.facebook?.trim());

  if (site) return ehRedeSocial(site) ? "rede_social" : "tem_site";

  // Sem site, mas com perfil de rede social registrado no OSM: é o caso
  // clássico de "só rede social", mesmo com o campo website vazio.
  if (temRede) return "rede_social";

  if (!temContato) return "sem_dado";
  return "sem_site";
}
