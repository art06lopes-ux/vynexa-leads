import type { QualidadeSite, StatusPresenca, StatusSite } from "@/db/tipos";

/**
 * Qualidade do site, a partir do que uma visita à página inicial mediu.
 *
 * Sinais objetivos, não estética: o site responde? Tem HTTPS? Se adapta
 * ao celular (meta viewport)? Demora? Mostra sinal de abandono (copyright
 * de anos atrás, gerador de CMS muito antigo, Flash, jQuery 1.x, layout
 * em tabela)? Com isso dá para separar com honestidade "site profissional"
 * de "site com problema" — e o operador vê a lista de sinais, não só o
 * rótulo.
 */

export type SinaisSite = {
  /** Respondeu 2xx (depois de redirecionamentos). */
  ok: boolean;
  statusHttp: number | null;
  https: boolean;
  tempoMs: number | null;
  viewport: boolean;
  doctypeHtml5: boolean;
  anoCopyright: number | null;
  /** Conteúdo de <meta name="generator">, quando existe. */
  gerador: string | null;
  flash: boolean;
  jqueryAntigo: boolean;
  layoutEmTabela: boolean;
  titulo: string | null;
  temDescricao: boolean;
  temOpenGraph: boolean;
  temLinkWhatsapp: boolean;
  tamanhoKb: number | null;
  /** O domínio redirecionou para outro (ex.: para o Instagram). */
  redirecionouPara: string | null;
};

export type Avaliacao = {
  qualidade: QualidadeSite;
  pontos: number;
  problemas: string[];
  positivos: string[];
};

const LENTO_MS = 3500;
const MUITO_LENTO_MS = 7000;

export function avaliarSinais(s: SinaisSite, anoAtual = new Date().getFullYear()): Avaliacao {
  if (!s.ok) {
    return {
      qualidade: "fora_do_ar",
      pontos: 0,
      problemas: [s.statusHttp ? `Respondeu com erro ${s.statusHttp}` : "Não respondeu"],
      positivos: [],
    };
  }

  const problemas: string[] = [];
  const positivos: string[] = [];
  let pontos = 100;
  const tirar = (n: number, motivo: string) => {
    pontos -= n;
    problemas.push(motivo);
  };

  if (!s.https) tirar(20, "Sem HTTPS (navegador marca como não seguro)");
  else positivos.push("HTTPS ativo");

  if (!s.viewport) tirar(30, "Não se adapta ao celular");
  else positivos.push("Adaptado ao celular");

  if (s.tempoMs !== null) {
    if (s.tempoMs > MUITO_LENTO_MS) tirar(20, `Muito lento (${(s.tempoMs / 1000).toFixed(1)} s)`);
    else if (s.tempoMs > LENTO_MS) tirar(10, `Lento (${(s.tempoMs / 1000).toFixed(1)} s)`);
    else positivos.push(`Carrega rápido (${(s.tempoMs / 1000).toFixed(1)} s)`);
  }

  if (!s.doctypeHtml5) tirar(10, "HTML antigo (sem doctype moderno)");
  if (s.flash) tirar(25, "Usa Flash, que nenhum navegador roda mais");
  if (s.jqueryAntigo) tirar(10, "Bibliotecas muito antigas (jQuery 1.x)");
  if (s.layoutEmTabela) tirar(10, "Layout montado em tabelas");

  if (s.anoCopyright !== null) {
    const idade = anoAtual - s.anoCopyright;
    if (idade >= 4) tirar(15, `Rodapé parado em ${s.anoCopyright}`);
    else if (idade >= 2) tirar(5, `Rodapé de ${s.anoCopyright}`);
  }

  if (s.gerador && /wordpress\s+[1-4]\./i.test(s.gerador)) tirar(10, `Plataforma desatualizada (${s.gerador})`);

  if (!s.titulo) tirar(5, "Página sem título");
  if (!s.temDescricao) tirar(5, "Sem descrição para o Google");
  if (s.temOpenGraph) positivos.push("Prévia pronta para redes sociais");
  if (s.temLinkWhatsapp) positivos.push("Botão de WhatsApp no site");

  pontos = Math.max(0, pontos);
  const qualidade: QualidadeSite = pontos >= 85 ? "excelente" : pontos >= 60 ? "bom" : "fraco";
  return { qualidade, pontos, problemas, positivos };
}

/** Une a presença declarada pela fonte com a nota da visita. */
export function statusPresenca(statusSite: StatusSite, qualidade: QualidadeSite | null): StatusPresenca {
  if (statusSite === "tem_site") return qualidade ?? "nao_avaliado";
  return statusSite;
}

export const ROTULO_PRESENCA: Record<StatusPresenca, string> = {
  excelente: "Excelente",
  bom: "Bom",
  fraco: "Fraco",
  fora_do_ar: "Site fora do ar",
  sem_site: "Sem site",
  rede_social: "Apenas redes sociais",
  nao_avaliado: "Site não avaliado",
  sem_dado: "Sem dados",
};

export const DESCRICAO_PRESENCA: Record<StatusPresenca, string> = {
  excelente: "Site profissional.",
  bom: "Site funcional, mas existem oportunidades.",
  fraco: "Site antigo ou com problemas.",
  fora_do_ar: "O endereço cadastrado não respondeu.",
  sem_site: "Nenhum site identificado.",
  rede_social: "Não possui site próprio.",
  nao_avaliado: "Tem site, ainda não visitado.",
  sem_dado: "A fonte não trouxe site nem contato.",
};

/** Prioridade de abordagem pela presença (1 = melhor lead). */
export const ORDEM_PRESENCA: Record<StatusPresenca, number> = {
  sem_site: 1,
  rede_social: 1,
  fora_do_ar: 2,
  fraco: 2,
  bom: 4,
  nao_avaliado: 4,
  excelente: 5,
  sem_dado: 6,
};

/** Extrai os sinais do HTML da página inicial. Puro: recebe texto. */
export function extrairSinaisDoHtml(html: string): Omit<SinaisSite, "ok" | "statusHttp" | "https" | "tempoMs" | "redirecionouPara"> {
  const inicio = html.slice(0, 4000).toLowerCase();
  const anos = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:[^<\d]{0,20})?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .map((m) => Number(m[2] ?? m[1]))
    .filter((n) => n >= 1995 && n <= 2100);
  const titulo = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null;
  const gerador = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  const tabelas = (html.match(/<table/gi) ?? []).length;
  const divs = (html.match(/<div/gi) ?? []).length;

  return {
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    doctypeHtml5: /^\s*<!doctype html>/i.test(inicio) || inicio.includes("<!doctype html>"),
    anoCopyright: anos.length > 0 ? Math.max(...anos) : null,
    gerador,
    flash: /\.swf\b|application\/x-shockwave-flash/i.test(html),
    jqueryAntigo: /jquery[.-]?1\.\d+(\.\d+)?(\.min)?\.js/i.test(html),
    layoutEmTabela: tabelas >= 4 && tabelas > divs / 2,
    titulo,
    temDescricao: /<meta[^>]+name=["']description["']/i.test(html),
    temOpenGraph: /<meta[^>]+property=["']og:/i.test(html),
    temLinkWhatsapp: /wa\.me\/|api\.whatsapp\.com\/send/i.test(html),
    tamanhoKb: Math.round(html.length / 1024),
  };
}
