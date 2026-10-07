"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Apaga o histórico de buscas (não os leads). Pede um segundo toque para confirmar. */
export function LimparBuscas() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function limpar() {
    if (!confirmando) {
      setConfirmando(true);
      setTimeout(() => setConfirmando(false), 4000);
      return;
    }
    setOcupado(true);
    try {
      const r = await fetch("/api/buscas", { method: "DELETE" });
      const d = (await r.json()) as { apagadas?: number; erro?: string };
      if (!r.ok) {
        toast.error(d.erro ?? "Não conseguimos limpar o histórico.");
        return;
      }
      toast.success(`Histórico limpo: ${d.apagadas ?? 0} busca(s) apagada(s). Os leads continuam na carteira.`);
      router.refresh();
    } catch {
      toast.error("Falha de rede ao limpar o histórico.");
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={limpar}
      disabled={ocupado}
      className={cn(
        "mt-2 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60",
        confirmando ? "bg-perigo/15 text-perigo hover:bg-perigo/25" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {ocupado ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      {confirmando ? "Toque de novo para apagar o histórico" : "Limpar histórico de buscas"}
    </button>
  );
}
