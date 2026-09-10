import { Globe, HelpCircle, Share2, ShieldOff } from "lucide-react";

import { ROTULO_STATUS_SITE, type StatusSite } from "@/db/tipos";
import { cn } from "@/lib/utils";

/**
 * Cada status tem cor, ícone E texto.
 *
 * Os três juntos de propósito: cor sozinha não é acessível a quem não
 * distingue verde de azul, e num painel de prospecção a diferença entre
 * "sem site" e "tem site" decide qual mensagem sai.
 */
const APARENCIA: Record<StatusSite, { classe: string; Icone: typeof Globe }> = {
  sem_site: {
    classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    Icone: ShieldOff,
  },
  rede_social: {
    classe: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    Icone: Share2,
  },
  tem_site: {
    classe: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    Icone: Globe,
  },
  sem_dado: {
    classe: "border-slate-400/25 bg-slate-400/10 text-slate-300",
    Icone: HelpCircle,
  },
};

export function BadgeStatusSite({ status, className }: { status: StatusSite; className?: string }) {
  const { classe, Icone } = APARENCIA[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        classe,
        className,
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {ROTULO_STATUS_SITE[status]}
    </span>
  );
}
