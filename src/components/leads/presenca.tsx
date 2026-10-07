import { CircleAlert, CircleCheck, CircleDashed, CircleOff, CircleX, Globe, type LucideIcon } from "lucide-react";

import type { EtapaLead, QualidadeSite, StatusSite } from "@/db/tipos";
import { cn } from "@/lib/utils";
import { ROTULO_ETAPA } from "@/services/crm";
import { ROTULO_PRESENCA, statusPresenca } from "@/services/qualidade-site";

/**
 * Selos de status. Cor + ícone + palavra, sempre juntos.
 */

const ESTILO: Record<string, { classe: string; icone: LucideIcon }> = {
  sem_site: { classe: "border-sucesso/30 bg-sucesso/10 text-sucesso", icone: CircleOff },
  rede_social: { classe: "border-aviso/30 bg-aviso/10 text-aviso", icone: Globe },
  fraco: { classe: "border-[#ff9a5c]/30 bg-[#ff9a5c]/10 text-[#ffb48a]", icone: CircleAlert },
  fora_do_ar: { classe: "border-perigo/30 bg-perigo/10 text-perigo", icone: CircleX },
  bom: { classe: "border-brilho/30 bg-azul/10 text-[#9db7ff]", icone: CircleCheck },
  excelente: { classe: "border-white/15 bg-white/5 text-muted-foreground", icone: CircleCheck },
  nao_avaliado: { classe: "border-white/15 bg-white/5 text-muted-foreground", icone: CircleDashed },
  sem_dado: { classe: "border-white/10 bg-white/[0.03] text-muted-foreground/80", icone: CircleDashed },
};

export function SeloPresenca({ statusSite, qualidade, className }: { statusSite: StatusSite; qualidade: QualidadeSite | null; className?: string }) {
  const p = statusPresenca(statusSite, qualidade);
  const { classe, icone: Icone } = ESTILO[p];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.7rem] font-semibold whitespace-nowrap", classe, className)}>
      <Icone className="size-3" aria-hidden="true" />
      {ROTULO_PRESENCA[p]}
    </span>
  );
}

const COR_ETAPA: Record<EtapaLead, string> = {
  novo: "border-white/15 bg-white/5 text-[#c9d3f2]",
  qualificado: "border-brilho/35 bg-azul/12 text-[#a9c0ff]",
  abordado: "border-ciano/30 bg-ciano/10 text-ciano",
  respondeu: "border-aviso/30 bg-aviso/10 text-aviso",
  negociacao: "border-[#b48cff]/30 bg-[#b48cff]/10 text-[#cdb4ff]",
  proposta: "border-[#ff9a5c]/30 bg-[#ff9a5c]/10 text-[#ffb48a]",
  fechado: "border-sucesso/30 bg-sucesso/10 text-sucesso",
  perdido: "border-perigo/25 bg-perigo/10 text-perigo",
};

export function SeloEtapa({ etapa, className }: { etapa: EtapaLead; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-[0.7rem] font-semibold whitespace-nowrap", COR_ETAPA[etapa], className)}>
      {ROTULO_ETAPA[etapa]}
    </span>
  );
}

export function SeloPrioridade({ prioridade }: { prioridade: string | null }) {
  if (!prioridade) return null;
  const mapa: Record<string, { texto: string; classe: string }> = {
    alta: { texto: "Alta prioridade", classe: "text-[#ff8a5c]" },
    media: { texto: "Média prioridade", classe: "text-aviso" },
    baixa: { texto: "Baixa prioridade", classe: "text-muted-foreground" },
  };
  const m = mapa[prioridade];
  if (!m) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", m.classe)}>
      <span className={cn("size-1.5 rounded-full", prioridade === "alta" ? "bg-[#ff8a5c]" : prioridade === "media" ? "bg-aviso" : "bg-muted-foreground")} />
      {m.texto}
    </span>
  );
}
