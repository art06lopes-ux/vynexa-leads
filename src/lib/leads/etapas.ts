import type { StatusLead } from "@/db/tipos";

/** As etapas do funil, na ordem em que um lead as percorre. */
export const ETAPAS: readonly StatusLead[] = ["novo", "contatado", "respondeu", "fechado", "nao_interessado"];

export const ROTULO_ETAPA: Record<StatusLead, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  fechado: "Fechado",
  nao_interessado: "Não quis",
};

/** Cor + palavra, sempre juntas: a cor sozinha não é acessível. */
export const CLASSE_ETAPA: Record<StatusLead, string> = {
  novo: "border-slate-400/25 bg-slate-400/10 text-slate-300",
  contatado: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  respondeu: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  fechado: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  nao_interessado: "border-rose-400/25 bg-rose-400/10 text-rose-300",
};

/** Só aceita etapa real vinda da URL; qualquer outra coisa é "sem filtro". */
export function lerEtapa(valor: string | null | undefined): StatusLead | undefined {
  return valor && (ETAPAS as readonly string[]).includes(valor) ? (valor as StatusLead) : undefined;
}

/** "há 3 dias", para o operador ver o que está parado. */
export function haQuantoTempo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const dias = Math.floor(ms / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}
