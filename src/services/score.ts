import type { MotivoScore, Prioridade, QualidadeSite, StatusSite } from "@/db/tipos";
import { simplificar } from "@/services/normalizacao";

/**
 * Score de oportunidade, de 0 a 100.
 *
 * Regra fixa e não opinião do modelo: o mesmo lead dá sempre o mesmo
 * número, e cada ponto vem com o motivo escrito — o operador vê POR QUE
 * o lead é bom, e pode discordar de uma regra específica em vez de
 * desconfiar de uma caixa-preta.
 *
 * Só soma o que a fonte trouxe. Avaliação ausente não tira ponto nem dá
 * ponto: não sabemos, e não saber não é sinal de nada.
 */

export type EntradaScore = {
  status_site: StatusSite;
  site_qualidade: QualidadeSite | null;
  whatsapp: number | null;
  email: string | null;
  instagram: string | null;
  avaliacao_nota: number | null;
  avaliacao_qtd: number | null;
  status_negocio: string | null;
  fonte: string;
  categoria: string;
  categoria_rotulo: string | null;
  telefone: string | null;
};

export type ResultadoScore = {
  score: number;
  motivos: MotivoScore[];
  prioridade: Prioridade;
};

export const PESOS = {
  semSite: 30,
  siteRuim: 20,
  siteBom: 5,
  siteModerno: -20,
  whatsapp: 15,
  email: 10,
  instagram: 5,
  notaAlta: 10,
  muitasAvaliacoes: 10,
  algumasAvaliacoes: 5,
  ativa: 10,
  categoriaDigital: 10,
} as const;

/** Corte de nota "alta" e de "muitas avaliações". */
export const NOTA_ALTA = 4.3;
export const MUITAS_AVALIACOES = 50;
export const ALGUMAS_AVALIACOES = 15;

/**
 * Segmentos em que o cliente procura antes de ir: agenda, compara preço,
 * vê foto, lê avaliação. Para eles um site com botão de WhatsApp vende
 * mais rápido. Termos em português, inglês e espanhol, sem acento.
 */
const CATEGORIAS_DIGITAIS = [
  "barbear", "barber", "salao", "salon", "cabeleire", "hair", "beleza", "beauty", "estetic", "aesthetic",
  "spa", "manicure", "nail", "sobrancelha", "lash", "maquiag", "makeup", "tattoo", "tatuag",
  "odonto", "dent", "clinic", "clinica", "medic", "doctor", "fisio", "physio", "psicolog", "nutri",
  "veterin", "vet", "pet", "advoca", "advog", "lawyer", "attorney", "law firm", "contab", "account",
  "imobili", "real estate", "realtor", "corretor", "arquitet", "architect", "construt", "contractor",
  "roof", "plumb", "encanad", "eletric", "electric", "hvac", "academia", "gym", "fitness", "personal",
  "crossfit", "pilates", "yoga", "restaurant", "pizzar", "hamburg", "burger", "cafe", "padaria", "bakery",
  "hotel", "pousada", "hostel", "inn", "motel", "fotograf", "photograph", "auto detail", "detailing",
  "estetica automotiva", "lava jato", "car wash", "oficina", "mecanic", "auto repair", "escola", "school",
  "curso", "idioma", "consultor", "consult", "agencia", "agency", "moveis", "furniture", "roupa", "boutique",
  "clothing", "loja", "store", "floricult", "florist", "buffet", "evento", "event", "casamento", "wedding",
];

export function categoriaDependeDePresencaDigital(categoria: string, rotulo: string | null): boolean {
  const texto = simplificar(`${categoria.replace(/_/g, " ")} ${rotulo ?? ""}`);
  return CATEGORIAS_DIGITAIS.some((termo) => texto.includes(termo));
}

export function prioridadeDoScore(score: number): Prioridade {
  if (score >= 70) return "alta";
  if (score >= 45) return "media";
  return "baixa";
}

export function calcularScore(e: EntradaScore): ResultadoScore {
  const motivos: MotivoScore[] = [];
  const somar = (pontos: number, motivo: string) => motivos.push({ pontos, motivo });

  // Presença na web. "sem_dado" não soma: sem site E sem contato é
  // ausência de informação, não ausência de site.
  if (e.status_site === "sem_site") somar(PESOS.semSite, "Não possui site");
  else if (e.status_site === "rede_social") somar(PESOS.semSite, "Só tem rede social, sem site próprio");
  else if (e.status_site === "tem_site") {
    if (e.site_qualidade === "fraco") somar(PESOS.siteRuim, "Site com problemas ou desatualizado");
    else if (e.site_qualidade === "fora_do_ar") somar(PESOS.siteRuim, "Site fora do ar");
    else if (e.site_qualidade === "bom") somar(PESOS.siteBom, "Site funcional, com espaço para melhorar");
    else if (e.site_qualidade === "excelente") somar(PESOS.siteModerno, "Site moderno e profissional");
  }

  if (e.whatsapp === 1) somar(PESOS.whatsapp, "Possui WhatsApp");
  if (e.email?.trim()) somar(PESOS.email, "Possui e-mail");
  if (e.instagram?.trim()) somar(PESOS.instagram, "Possui Instagram");

  if (e.avaliacao_nota !== null && e.avaliacao_nota >= NOTA_ALTA && (e.avaliacao_qtd ?? 0) > 0) {
    somar(PESOS.notaAlta, `Nota ${formatarNota(e.avaliacao_nota)} no Google`);
  }
  if (e.avaliacao_qtd !== null) {
    if (e.avaliacao_qtd >= MUITAS_AVALIACOES) somar(PESOS.muitasAvaliacoes, `${e.avaliacao_qtd} avaliações no Google`);
    else if (e.avaliacao_qtd >= ALGUMAS_AVALIACOES) somar(PESOS.algumasAvaliacoes, `${e.avaliacao_qtd} avaliações no Google`);
  }

  // "Aparentemente ativa": a fonte afirma que está funcionando. Fechada
  // de vez é tratada à parte — não há o que vender a quem fechou.
  if (e.status_negocio === "OPERATIONAL") somar(PESOS.ativa, "Empresa em funcionamento segundo o Google");
  else if (e.fonte === "receita") somar(PESOS.ativa, "Cadastro ativo na Receita Federal");

  if (categoriaDependeDePresencaDigital(e.categoria, e.categoria_rotulo)) {
    somar(PESOS.categoriaDigital, "Segmento que depende de presença digital");
  }

  let score = motivos.reduce((t, m) => t + m.pontos, 0);
  if (e.status_negocio === "CLOSED_PERMANENTLY") {
    motivos.push({ pontos: -score, motivo: "Fechada permanentemente segundo o Google" });
    score = 0;
  }
  score = Math.max(0, Math.min(100, score));

  return { score, motivos, prioridade: prioridadeDoScore(score) };
}

function formatarNota(nota: number): string {
  return nota.toFixed(1).replace(".", ",");
}
