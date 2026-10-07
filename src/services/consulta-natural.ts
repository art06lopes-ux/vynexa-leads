import { separarLocalBR } from "@/lib/geo/estados-br";
import { codigoDoPaisPorNome, paisDaRegiao } from "@/lib/geo/mundo";
import { simplificar } from "@/services/normalizacao";

/**
 * Busca em linguagem natural → filtros.
 *
 * "Quero empresas de estética automotiva em Miami que não possuem site e
 * tenham mais de 50 avaliações" vira { termo: "estética automotiva",
 * local: "Miami", pais: "US", site: "sem", avaliacoesMin: 50 }.
 *
 * Este é o interpretador por regras: roda sem IA, sem custo e sem
 * latência, e cobre as formas comuns em português, inglês e espanhol.
 * Quando a IA está configurada, `QueryParser` (src/integrations/ai)
 * tenta primeiro e este aqui é a rede de segurança — e o validador do
 * que a IA devolveu.
 */

export type FiltroSite = "todos" | "sem" | "com" | "ruim";

export type ConsultaInterpretada = {
  termo: string;
  local: string | null;
  pais: string | null;
  /** No Brasil: sigla do estado, quando o local cita um ("Santa Catarina", "SC"). */
  uf: string | null;
  /** Cidade, sem o estado ("Florianópolis, SC" → "Florianópolis"). Nula quando o local é só o estado. */
  cidade: string | null;
  site: FiltroSite;
  comWhatsapp: boolean;
  comEmail: boolean;
  comInstagram: boolean;
  avaliacoesMin: number | null;
  notaMin: number | null;
  scoreMin: number | null;
  /** O que foi reconhecido, em frases curtas — a interface mostra como chips. */
  reconhecido: string[];
};

const RE_SEM_SITE =
  /\b(sem|nao (tem|tenham|possuem|possui|tenha)|que nao tem|without|with no|no|sin)\s+(um\s+|o\s+|own\s+|a\s+)?(site|website|web site|pagina web|sitio web|web)( proprio)?\b/;
const RE_COM_SITE = /\b(com|with|con|que tem|que possuem|que tenham)\s+(um\s+|o\s+|a\s+)?(site|website|sitio web)( proprio)?\b/;
const RE_SITE_RUIM =
  /\b(site|website)s?\s+(ruim|ruins|fraco|fracos|antigo|antigos|desatualizado|desatualizados|ultrapassado|velho|bad|old|outdated|poor)\b|\b(bad|old|outdated|poor)\s+(site|website)s?\b/;
const RE_WHATS = /\b(com|with|con|que tenham|que tem)\s+(o\s+)?whats ?app\b|\bwhats ?app\b/;
const RE_EMAIL = /\b(com|with|con|que tenham|que tem)\s+(o\s+)?e ?mail\b/;
const RE_INSTA = /\b(com|with|con)\s+(o\s+)?insta(gram)?\b/;
const RE_AVALIACOES =
  /\b(mais de|acima de|pelo menos|no minimo|minimo de|over|more than|at least|mas de|al menos)\s+(\d{1,6})\s+(avaliacoes|avaliacao|reviews?|resenas|comentarios|opinioes)\b|\b(\d{1,6})\+?\s+(avaliacoes|reviews|resenas)\b/;
const RE_NOTA =
  /\b(nota|rating|estrelas|calificacion)\s+(acima de|maior que|minima de|de pelo menos|above|over|at least|mayor a|minimo)?\s*(\d(?:[.,]\d)?)\b|\b(\d(?:[.,]\d)?)\s*(estrelas|stars|★)\s*(ou mais|or more|\+)?/;
const RE_SCORE = /\bscore\s+(acima de|maior que|minimo de|de pelo menos|above|over|at least|>=?)?\s*(\d{1,3})\b/;

/** Palavras de preenchimento no começo da frase. */
const PREAMBULO =
  /^(quero|queria|gostaria de|preciso de|preciso|me (mostre|mostra|traga|encontre|ache)|mostre|encontre|ache|buscar|busque|procure|procurar|encontrar|find|show me|search for|search|get me|i want|quiero|busca|buscar|encuentra)\s+/;
const PREAMBULO_2 = /^(encontrar|achar|ver|buscar|find|ver)\s+/;
const PREFIXO_EMPRESA = /^(as\s+|os\s+|the\s+|las\s+|los\s+)?(empresas|negocios|lojas|estabelecimentos|businesses|companies|empresas)\s+(de|do|da|dos|das|of|that are)\s+/;
const PREFIXO_TODAS = /^(todas as|todos os|all|todas las|todos los)\s+/;

/**
 * Separadores de local. Primeiro os inequívocos ("em", "in", "en",
 * "near"); só sem nenhum deles vale "no/na" — "no Rio de Janeiro". "de"
 * nunca: "Clínica de estética em Manaus" tem um "de" que não é lugar.
 */
const RE_LOCAL = /\s(?:em|in|en|near|perto de|around)\s+(.+)$/i;
const RE_LOCAL_FRACO = /\s(?:no|na|nos|nas)\s+(.+)$/i;

const QUALQUER_LUGAR = /\b(qualquer lugar|todo o mundo|mundo todo|anywhere|worldwide|everywhere|cualquier lugar|todo el mundo)\b/;

export function interpretarConsulta(texto: string): ConsultaInterpretada {
  const original = texto.trim();
  const t = ` ${simplificar(original)} `;
  const reconhecido: string[] = [];

  let site: FiltroSite = "todos";
  if (RE_SITE_RUIM.test(t)) {
    site = "ruim";
    reconhecido.push("Site fraco ou desatualizado");
  } else if (RE_SEM_SITE.test(t)) {
    site = "sem";
    reconhecido.push("Sem site");
  } else if (RE_COM_SITE.test(t)) {
    site = "com";
    reconhecido.push("Com site");
  }

  const comWhatsapp = RE_WHATS.test(t);
  if (comWhatsapp) reconhecido.push("Com WhatsApp");
  const comEmail = RE_EMAIL.test(t);
  if (comEmail) reconhecido.push("Com e-mail");
  const comInstagram = RE_INSTA.test(t);
  if (comInstagram) reconhecido.push("Com Instagram");

  let avaliacoesMin: number | null = null;
  const av = RE_AVALIACOES.exec(t);
  if (av) {
    avaliacoesMin = Number(av[2] ?? av[4]);
    reconhecido.push(`${avaliacoesMin}+ avaliações`);
  }

  let notaMin: number | null = null;
  // Nota precisa da vírgula/ponto decimal, que `simplificar` remove.
  const comDecimal = ` ${original.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
  const nota = RE_NOTA.exec(comDecimal);
  if (nota) {
    const valor = Number((nota[3] ?? nota[4] ?? "").replace(",", "."));
    if (valor > 0 && valor <= 5) {
      notaMin = valor;
      reconhecido.push(`Nota ${valor.toString().replace(".", ",")}+`);
    }
  }

  let scoreMin: number | null = null;
  const sc = RE_SCORE.exec(t);
  if (sc) {
    scoreMin = Math.min(100, Number(sc[2]));
    reconhecido.push(`Score ${scoreMin}+`);
  }

  // Termo e local saem do texto ORIGINAL (com acento e caixa), cortando
  // as cláusulas já interpretadas.
  let base = original.replace(/[.!?]+$/, "").trim();
  const baseSimples = () => simplificar(base);

  base = removerPrefixo(base, PREAMBULO);
  base = removerPrefixo(base, PREAMBULO_2);
  base = removerPrefixo(base, PREFIXO_EMPRESA);
  base = removerPrefixo(base, PREFIXO_TODAS);

  const qualquerLugar = QUALQUER_LUGAR.test(` ${baseSimples()} `);
  if (qualquerLugar) {
    base = base.replace(/\s*(em |in |en )?(qualquer lugar|todo o mundo|mundo todo|anywhere|worldwide|everywhere|cualquier lugar|todo el mundo)\s*/i, " ").trim();
  }

  // Corta filtros que vêm DEPOIS do local ("... em Miami que não possuem site").
  const corte = cortarClausulas(base);
  base = corte;

  // Filtro de site colado ao termo: "Barbearias sem site em Manacapuru".
  base = base
    .replace(/\s+(sem|without|sin)\s+(a\s+|an\s+|um\s+|own\s+)?(site|website|sitio web|web)(\s+pr[oó]prio)?\b/i, "")
    .replace(/\s+(com|with|con)\s+(site|website|whats ?app|e-?mail|instagram)\b/gi, "")
    .replace(/\s+(com|with)\s+(site|website)s?\s+(ruim|ruins|fraco|antigo|desatualizado|bad|old|outdated)\b/i, "")
    .trim();

  let termo = base;
  let local: string | null = null;
  const m = RE_LOCAL.exec(` ${base}`) ?? RE_LOCAL_FRACO.exec(` ${base}`);
  if (m && m.index !== undefined) {
    local = m[1].trim().replace(/^(the|o|a|os|as)\s+/i, "") || null;
    termo = ` ${base}`.slice(0, m.index).trim();
  }

  termo = termo.replace(/\s+(de|do|da|of)$/i, "").trim();

  let pais: string | null = null;
  let uf: string | null = null;
  let cidade: string | null = null;
  if (local) {
    const partes = local.split(/\s*[,/-]\s*/).filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? local;
    pais = codigoDoPaisPorNome(ultimo) ?? codigoDoPaisPorNome(local) ?? paisDaRegiao(partes[0] ?? local) ?? paisDaRegiao(local);
    if (!codigoDoPaisPorNome(local) && (pais === null || pais === "BR")) {
      const br = separarLocalBR(local);
      if (br.uf) {
        pais = "BR";
        uf = br.uf;
      }
      cidade = br.cidade;
    } else if (!codigoDoPaisPorNome(local)) {
      cidade = partes[0] ?? null;
    }
    // O local é SÓ o país: busca no país inteiro.
    if (codigoDoPaisPorNome(local)) reconhecido.unshift(`País: ${local}`);
    else if (uf && !cidade) reconhecido.unshift(`Estado: ${uf}`);
    else reconhecido.unshift(`Local: ${local}`);
  } else if (qualquerLugar) {
    reconhecido.unshift("Qualquer lugar");
  }

  if (termo) reconhecido.unshift(`Categoria: ${termo}`);

  return {
    termo,
    local,
    pais,
    uf,
    cidade,
    site,
    comWhatsapp,
    comEmail,
    comInstagram,
    avaliacoesMin,
    notaMin,
    scoreMin,
    reconhecido,
  };
}

function removerPrefixo(texto: string, padrao: RegExp): string {
  const simples = simplificar(texto);
  const m = padrao.exec(`${simples} `);
  if (!m) return texto;
  // Remove o mesmo número de PALAVRAS do texto original.
  const palavras = m[0].trim().split(/\s+/).length;
  return texto.split(/\s+/).slice(palavras).join(" ");
}

function cortarClausulas(texto: string): string {
  const palavras = texto.split(/\s+/);
  const simples = palavras.map((p) => simplificar(p));
  // Procura a primeira palavra que abre uma cláusula de filtro, a partir
  // da terceira posição (o termo tem pelo menos uma palavra antes).
  const aberturas = new Set(["que", "onde", "where", "which", "that", "y", "e", "and"]);
  for (let i = 1; i < simples.length; i += 1) {
    if (aberturas.has(simples[i]) && /^(nao|não|tem|tenham|possuem|possui|have|has|tengan|tienen|no|with|com|sem|mais|more)$/.test(simples[i + 1] ?? "")) {
      return palavras.slice(0, i).join(" ");
    }
  }
  return texto;
}

/** Monta a frase de volta a partir dos filtros (para mostrar ao usuário). */
export function descreverConsulta(c: Pick<ConsultaInterpretada, "termo" | "local" | "site">): string {
  const site = c.site === "sem" ? " sem site" : c.site === "com" ? " com site" : c.site === "ruim" ? " com site fraco" : "";
  return `${c.termo || "Empresas"}${site}${c.local ? ` em ${c.local}` : ""}`;
}
