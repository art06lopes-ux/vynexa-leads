"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, LoaderCircle, Megaphone, Sparkles, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Seleção em massa e a barra de ações que aparece com ela.
 *
 * "Selecionar" escolhe os N melhores (por score) que casam com o filtro
 * atual — 10, 25, 50, 100, 500 ou 1000 —, pedidos ao servidor; a
 * seleção não depende do que já está carregado na tela.
 */

export const TAMANHOS = [10, 25, 50, 100, 500, 1000];

export function useSelecao() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  return {
    ids,
    tamanho: ids.size,
    tem: (id: string) => ids.has(id),
    alternar: (id: string) =>
      setIds((atual) => {
        const novo = new Set(atual);
        if (novo.has(id)) novo.delete(id);
        else novo.add(id);
        return novo;
      }),
    definir: (lista: string[]) => setIds(new Set(lista)),
    limpar: () => setIds(new Set()),
  };
}

export function SeletorQuantidade({ consulta, aoSelecionar, total }: { consulta: string; aoSelecionar: (ids: string[]) => void; total: number }) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function selecionar(n: number) {
    setAberto(false);
    setOcupado(true);
    try {
      const r = await fetch(`/api/leads/ids?${consulta}&limite=${n}`);
      const d = (await r.json()) as { ids?: string[]; erro?: string };
      if (!r.ok || !d.ids) throw new Error(d.erro ?? "Falha ao selecionar.");
      aoSelecionar(d.ids);
      toast.success(`${d.ids.length} leads selecionados (os de maior score).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={total === 0}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm font-medium transition-colors hover:border-brilho/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Selecionar <ChevronDown className="size-3.5" />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-11 z-30 w-52 rounded-xl border border-fio bg-popover p-1.5 shadow-2xl"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-xs text-muted-foreground">Os de maior score no filtro atual</p>
            {TAMANHOS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={n > total && n !== TAMANHOS.find((t) => t >= total)}
                onClick={() => selecionar(n)}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Top {n.toLocaleString("pt-BR")}
                <span className="text-xs text-muted-foreground">{Math.min(n, total).toLocaleString("pt-BR")}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CHAVE_CAMPANHA = "vynexa:leads-para-campanha";

export function guardarParaCampanha(ids: string[], origem: string): void {
  try {
    sessionStorage.setItem(CHAVE_CAMPANHA, JSON.stringify({ ids, origem }));
  } catch {
    /* sem storage: a tela de campanha pede a seleção de novo */
  }
}

export function lerParaCampanha(): { ids: string[]; origem: string } | null {
  try {
    const v = sessionStorage.getItem(CHAVE_CAMPANHA);
    return v ? (JSON.parse(v) as { ids: string[]; origem: string }) : null;
  } catch {
    return null;
  }
}

export function BarraMassa({ ids, aoLimpar, origem }: { ids: Set<string>; aoLimpar: () => void; origem: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = [...ids];

  async function massa(analisar: boolean, gerarMensagens: boolean, rotulo: string) {
    setOcupado(rotulo);
    try {
      const r = await fetch("/api/leads/massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: lista, analisar, gerarMensagens }),
      });
      const d = (await r.json()) as { erro?: string; codigo?: string };
      if (!r.ok) {
        toast.error(d.erro ?? "Não foi possível iniciar.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => router.push("/configuracoes?aba=integracoes") } } : undefined);
        return;
      }
      toast.success(`${rotulo}: ${lista.length} lead(s) na fila. Avisaremos no sino quando terminar.`);
    } catch {
      toast.error("Falha de rede. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function exportar(formato: string) {
    setOcupado("exportar");
    try {
      const r = await fetch(`/api/exportar?formato=${formato}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: lista }) });
      if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro ?? "Falha ao exportar.");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `leads-vynexa.${formato}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setOcupado(null);
    }
  }

  const botao = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <AnimatePresence>
      {ids.size > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border border-brilho/40 bg-popover/95 p-2 pl-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_30px_-10px_rgba(51,102,255,0.5)] backdrop-blur-xl lg:left-[15.5rem]"
          role="region"
          aria-label="Ações em massa"
        >
          <p className="mr-auto text-sm">
            <span className="font-display font-semibold num">{ids.size.toLocaleString("pt-BR")}</span> <span className="text-muted-foreground">selecionado(s)</span>
          </p>
          <button type="button" disabled={ocupado !== null} onClick={() => massa(true, false, "Análise")} className={cn(botao, "hover:bg-white/5")}>
            {ocupado === "Análise" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4 text-ciano" />} Analisar
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => massa(false, true, "Mensagens")} className={cn(botao, "hover:bg-white/5")}>
            {ocupado === "Mensagens" ? <LoaderCircle className="size-4 animate-spin" /> : <Wand2 className="size-4 text-ciano" />} Gerar mensagens
          </button>
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => {
              guardarParaCampanha(lista, origem);
              router.push("/campanhas/nova");
            }}
            className={cn(botao, "bg-azul text-white hover:bg-brilho")}
          >
            <Megaphone className="size-4" /> Criar campanha
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => exportar("csv")} className={cn(botao, "hover:bg-white/5")} title="Exportar CSV">
            {ocupado === "exportar" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button type="button" onClick={aoLimpar} aria-label="Limpar seleção" className={cn(botao, "px-2 text-muted-foreground hover:bg-white/5")}>
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
