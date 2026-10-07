import type { EtapaLead } from "@/db/tipos";

/**
 * O pipeline comercial.
 *
 * Oito etapas, na ordem em que um lead as percorre. Qualquer movimento é
 * permitido — negociação real volta atrás —, mas cada etapa carimba o que
 * significa: entrar em "abordado" registra quando foi o contato, entrar em
 * "respondeu" registra a resposta. O histórico guarda o resto.
 */
export const ETAPAS: readonly EtapaLead[] = [
  "novo",
  "qualificado",
  "abordado",
  "respondeu",
  "negociacao",
  "proposta",
  "fechado",
  "perdido",
];

export const ROTULO_ETAPA: Record<EtapaLead, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  abordado: "Abordado",
  respondeu: "Respondeu",
  negociacao: "Negociação",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

/** Uma frase para o topo de cada coluna do Kanban. */
export const DESCRICAO_ETAPA: Record<EtapaLead, string> = {
  novo: "Encontrados, ainda não avaliados",
  qualificado: "Vale a pena abordar",
  abordado: "Primeira mensagem enviada",
  respondeu: "Responderam a abordagem",
  negociacao: "Conversa em andamento",
  proposta: "Proposta enviada",
  fechado: "Venda fechada",
  perdido: "Não seguiu adiante",
};

export function ehEtapa(valor: unknown): valor is EtapaLead {
  return typeof valor === "string" && (ETAPAS as readonly string[]).includes(valor);
}

export function lerEtapa(valor: string | null | undefined): EtapaLead | undefined {
  return ehEtapa(valor) ? valor : undefined;
}

/** Etapas em que o lead já foi contatado (entram na taxa de resposta). */
export const ETAPAS_CONTATADAS: readonly EtapaLead[] = ["abordado", "respondeu", "negociacao", "proposta", "fechado", "perdido"];
export const ETAPAS_RESPONDERAM: readonly EtapaLead[] = ["respondeu", "negociacao", "proposta", "fechado"];

/**
 * Colunas extras a gravar quando o lead ENTRA numa etapa. Só carimba o
 * que ainda está vazio: mover de volta e de novo para "abordado" não
 * apaga a data do primeiro contato.
 */
export function carimbosDaEtapa(etapa: EtapaLead): Array<"contatado_em" | "respondeu_em"> {
  const ordem = ETAPAS.indexOf(etapa);
  const carimbos: Array<"contatado_em" | "respondeu_em"> = [];
  if (etapa !== "perdido" && ordem >= ETAPAS.indexOf("abordado")) carimbos.push("contatado_em");
  if (etapa !== "perdido" && ordem >= ETAPAS.indexOf("respondeu")) carimbos.push("respondeu_em");
  return carimbos;
}

/** Próxima etapa natural — o botão "avançar" do card. */
export function proximaEtapa(etapa: EtapaLead): EtapaLead | null {
  if (etapa === "fechado" || etapa === "perdido") return null;
  return ETAPAS[ETAPAS.indexOf(etapa) + 1] ?? null;
}

export function taxa(parte: number, todo: number): number | null {
  return todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null;
}

/** "há 3 dias", para o operador ver o que está parado. */
export function haQuantoTempo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}
