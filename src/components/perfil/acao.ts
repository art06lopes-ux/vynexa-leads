"use client";

import { toast } from "sonner";

/** Chama a rota de ações do lead e mostra o erro de forma legível. */
export async function acaoLead<T = Record<string, unknown>>(leadId: string, corpo: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch(`/api/leads/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const d = (await r.json().catch(() => ({}))) as T & { erro?: string; codigo?: string };
    if (!r.ok) {
      toast.error(d.erro ?? "Não conseguimos concluir esta ação.", {
        action:
          d.codigo === "sem_configuracao"
            ? { label: "Configurar", onClick: () => (window.location.href = "/configuracoes?aba=integracoes") }
            : undefined,
      });
      return null;
    }
    return d;
  } catch {
    toast.error("Falha de rede. Tente de novo.");
    return null;
  }
}
