"use client";

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { StatusLead } from "@/db/tipos";
import { CLASSE_ETAPA, ETAPAS, ROTULO_ETAPA } from "@/lib/leads/etapas";
import { mudarEtapaLead } from "@/server/acoes-leads";
import { cn } from "@/lib/utils";

/**
 * A etapa do lead como um chip que é, na verdade, um <select>.
 *
 * Um clique e pronto: sem diálogo, sem confirmação. É a ação mais
 * frequente do dia — "mandei, respondeu, fechou" — e cada tela a mais
 * seria uma razão para não anotar.
 */
export function SeletorEtapa({
  empresaId,
  etapa,
  className,
}: {
  empresaId: string;
  etapa: StatusLead | null;
  className?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const atual: StatusLead = etapa ?? "novo";

  function mudar(nova: StatusLead) {
    if (nova === atual) return;
    iniciar(async () => {
      const r = await mudarEtapaLead(empresaId, nova);
      if (!r.ok) toast.error("Não consegui mudar a etapa.");
      else if (nova === "fechado") toast.success("Fechado! Registre a venda em Vendas para entrar no faturamento.");
    });
  }

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <select
        aria-label="Etapa do lead"
        value={atual}
        disabled={pendente}
        onChange={(e) => mudar(e.target.value as StatusLead)}
        className={cn(
          "h-8 cursor-pointer appearance-none rounded-full border py-1 pl-3 pr-7 text-xs font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
          CLASSE_ETAPA[atual],
        )}
      >
        {ETAPAS.map((e) => (
          <option key={e} value={e} className="bg-popover text-foreground">
            {ROTULO_ETAPA[e]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 text-[0.6rem] opacity-70">
        {pendente ? <LoaderCircle className="size-3 animate-spin" /> : "▼"}
      </span>
    </span>
  );
}
