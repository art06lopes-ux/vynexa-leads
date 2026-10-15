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
  "contate.me",
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
  return ALIMENTACAO.test(normalizar(categoria));
}

/** O link é de um cardápio ou plataforma de pedido (Brendi, Anota Aí, iFood…)? */
export function ehCardapioOnline(website: string | null | undefined): boolean {
  const dominio = extrairDominio(website);
  if (dominio === null) return false;
  return DOMINIOS_CARDAPIO.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/**
 * Agendamento online de beleza. Barbearia ou salão que só tem a página
 * da AppBarber, Trinks, Booksy… no Google não tem site: é a agenda de uma
 * plataforma. Vale só para beleza (ver `ehBeleza`).
 */
const DOMINIOS_AGENDA = [
  "appbarber.com.br",
  "barbercode.com.br",
  "cashbarber.com.br",
  "inbarber.com.br",
  "trinks.com",
  "avec.app",
  "avec.beauty",
  "salaovip.com.br",
  "salao99.com.br",
  "beautydate.com.br",
  "simplesagenda.com.br",
  "belasis.com.br",
  "agendapro.com",
  "booksy.com",
  "fresha.com",
  "vagaro.com",
  "styleseat.com",
  "schedulicity.com",
  "setmore.com",
  "calendly.com",
];

const BELEZA =
  /barbear|barber|salao|cabeleire|cabelo|\bhair|estetica|manicure|pedicure|\bunha|\bnail|sobrancelh|cilios|\blash|maquiag|makeup|depila|\bspa\b|massag|beleza|beauty|podolog|micropigment|tranc|esmalter/;

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
}

/** Barbearia, salão, estética, manicure, sobrancelha… pela categoria da busca ou do Google. */
export function ehBeleza(categoria: string | null | undefined): boolean {
  return Boolean(categoria) && BELEZA.test(normalizar(categoria!));
}

/** O link é de uma agenda online de beleza (AppBarber, Trinks, Booksy…)? */
export function ehAgendaOnline(website: string | null | undefined): boolean {
  const dominio = extrairDominio(website);
  if (dominio === null) return false;
  return DOMINIOS_AGENDA.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

export type Plataforma = "cardapio" | "agenda";

/** Qual plataforma de terceiro é o endereço, se for alguma (sem olhar o ramo). */
export function plataformaDoLink(website: string | null | undefined): Plataforma | null {
  if (ehCardapioOnline(website)) return "cardapio";
  if (ehAgendaOnline(website)) return "agenda";
  return null;
}

/** A plataforma só conta como "sem site" no ramo dela: cardápio em alimentação, agenda em beleza. */
export function plataformaValeNoRamo(plataforma: Plataforma | null | undefined, categoria: string | null | undefined): boolean {
  if (plataforma === "cardapio") return ehAlimentacao(categoria);
  if (plataforma === "agenda") return ehBeleza(categoria);
  return false;
}

/**
 * A página é de uma plataforma de cardápio mesmo com domínio próprio
 * ("white label"): os scripts, estilos e links dela vêm da plataforma.
 * Duas referências bastam — um site de verdade pode ter UM botão para o
 * iFood, mas não carrega a loja inteira de lá.
 */
export function plataformaNaPagina(html: string): Plataforma | null {
  const n: Record<Plataforma, number> = { cardapio: 0, agenda: 0 };
  for (const m of html.matchAll(/(?:src|href|content)\s*=\s*["']https?:\/\/([^/"'\s>]+)/gi)) {
    const p = plataformaDoLink(m[1]);
    if (p && ++n[p] >= 2) return p;
  }
  return null;
}

export function paginaDeCardapio(html: string): boolean {
  return plataformaNaPagina(html) === "cardapio";
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
  /** Categoria da busca/Google. Cardápio (alimentação) ou agenda (beleza) de plataforma não conta como site. */
  categoria?: string | null | undefined;
  telefone: string | null | undefined;
  email?: string | null | undefined;
  instagram?: string | null | undefined;
  facebook?: string | null | undefined;
}): StatusSite {
  const site = entrada.website?.trim();
  const temContato = Boolean(entrada.telefone?.trim() || entrada.email?.trim());
  const temRede = Boolean(entrada.instagram?.trim() || entrada.facebook?.trim());

  if (site) return ehRedeSocial(site) || plataformaValeNoRamo(plataformaDoLink(site), entrada.categoria) ? "rede_social" : "tem_site";

  // Sem site, mas com perfil de rede social registrado no OSM: é o caso
  // clássico de "só rede social", mesmo com o campo website vazio.
  if (temRede) return "rede_social";

  if (!temContato) return "sem_dado";
  return "sem_site";
}
