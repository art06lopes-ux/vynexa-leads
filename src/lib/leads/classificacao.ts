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

/**
 * Cardápios e plataformas de pedido. Para restaurante, hamburgueria e
 * afins, ter só um link destes no Google não é ter site: é a vitrine de
 * uma plataforma de terceiro — e o lead mais quente para um site próprio.
 * Vale só para alimentação (ver `ehAlimentacao`).
 */
const DOMINIOS_CARDAPIO = [
  // Brasil
  "brendi.com.br",
  "brendi.app",
  "anota.ai",
  "anotaai.com",
  "goomer.app",
  "goomer.com.br",
  "cardapioweb.com",
  "menudino.com",
  "olaclick.com",
  "ola.click",
  "instadelivery.com.br",
  "deliverydireto.com.br",
  "neemo.com.br",
  "saipos.com",
  "jotaja.com",
  "tagme.com.br",
  "yooga.com.br",
  "kyte.site",
  "mandarpedido.com",
  "pedidos.app",
  "cardapio.ai",
  // Apps de entrega
  "ifood.com.br",
  "deliverymuch.com.br",
  "aiqfome.com",
  "rappi.com.br",
  "rappi.com",
  "99app.com",
  "ubereats.com",
  "pedidosya.com",
  "glovoapp.com",
  // Fora do Brasil
  "foodbooking.com",
  "gloriafood.com",
  "menufy.com",
  "toasttab.com",
  "square.site",
  "chownow.com",
  "order.online",
  "doordash.com",
  "grubhub.com",
  "slicelife.com",
  "beyondmenu.com",
  "menupages.com",
  "allmenus.com",
  "zmenu.com",
];

const ALIMENTACAO =
  /restaura|lanchonete|lanche|hamburg|burger|pizz|churrasc|espet|sushi|japones|temaki|acai|sorvet|gelat|padaria|panific|confeit|docer|bolo|cafeteria|\bcafe\b|\bbar\b|boteco|\bpub\b|cervej|petisc|pastel|marmit|comida|\bfood|delivery|cozinha|bistro|cantina|tapioca|salgad|crepe|hot ?dog|cachorro.quente|frango|grill|steak|peixar|frutos do mar|\bmeal|bakery|ice cream|diner|takeaway|parrilla|esfi|arabe|mexican|\bpoke|yakisoba|chines|tacaca|sanduich|açai/;

/** Restaurante, hamburgueria, pizzaria, açaí, padaria… pela categoria da busca ou do Google. */
export function ehAlimentacao(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  const t = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
  return ALIMENTACAO.test(t);
}

/** O link é de um cardápio ou plataforma de pedido (Brendi, Anota Aí, iFood…)? */
export function ehCardapioOnline(website: string | null | undefined): boolean {
  const dominio = extrairDominio(website);
  if (dominio === null) return false;
  return DOMINIOS_CARDAPIO.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/**
 * A página é de uma plataforma de cardápio mesmo com domínio próprio
 * ("white label"): os scripts, estilos e links dela vêm da plataforma.
 * Duas referências bastam — um site de verdade pode ter UM botão para o
 * iFood, mas não carrega a loja inteira de lá.
 */
export function paginaDeCardapio(html: string): boolean {
  let n = 0;
  for (const m of html.matchAll(/(?:src|href|content)\s*=\s*["']https?:\/\/([^/"'\s>]+)/gi)) {
    if (ehCardapioOnline(m[1]) && ++n >= 2) return true;
  }
  return false;
}

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
  /** Categoria da busca/Google. Em alimentação, link de cardápio não conta como site. */
  categoria?: string | null | undefined;
  telefone: string | null | undefined;
  email?: string | null | undefined;
  instagram?: string | null | undefined;
  facebook?: string | null | undefined;
}): StatusSite {
  const site = entrada.website?.trim();
  const temContato = Boolean(entrada.telefone?.trim() || entrada.email?.trim());
  const temRede = Boolean(entrada.instagram?.trim() || entrada.facebook?.trim());

  if (site) return ehRedeSocial(site) || (ehAlimentacao(entrada.categoria) && ehCardapioOnline(site)) ? "rede_social" : "tem_site";

  // Sem site, mas com perfil de rede social registrado no OSM: é o caso
  // clássico de "só rede social", mesmo com o campo website vazio.
  if (temRede) return "rede_social";

  if (!temContato) return "sem_dado";
  return "sem_site";
}
