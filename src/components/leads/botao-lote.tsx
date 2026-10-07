"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Dispara a análise de IA para uma lista fixa de leads. */
export function BotaoAnalisarLote({ ids, rotulo, gerarMensagens = false }: { ids: string[]; rotulo: string; gerarMensagens?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        try {
          const r = await fetch("/api/leads/massa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: ids, analisar: true, gerarMensagens }) });
          const d = (await r.json()) as { erro?: string };
          if (!r.ok) toast.error(d.erro ?? "Não foi possível iniciar.");
          else toast.success(`${ids.length} lead(s) na fila de análise. Avisaremos no sino.`);
        } catch {
          toast.error("Falha de rede.");
        } finally {
          setOcupado(false);
        }
      }}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60"
    >
      {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {rotulo}
    </button>
  );
}
