"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { GraficoArea } from "@/components/graficos/graficos";
import { Contador } from "@/components/motion/contador";
import type { VendaPaga } from "@/db/painel";
import { agrupar, PERIODOS, type Periodo } from "@/lib/periodos";
import { cn } from "@/lib/utils";

/** Selo de variação contra o período anterior. */
export function Variacao({ valor, claro = false }: { valor: number | null; claro?: boolean }) {
  if (valor === null) return <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", claro ? "bg-black/25 text-white/80" : "bg-white/[0.06] text-muted-foreground")}>novo</span>;
  const sobe = valor >= 0;
  const Icone = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold num",
        claro ? "bg-black/25 text-white" : sobe ? "bg-sucesso/12 text-sucesso" : "bg-perigo/12 text-perigo",
      )}
      title="Comparado ao período anterior do mesmo tamanho"
    >
      <Icone className="size-3" />
      {Math.abs(valor).toLocaleString("pt-BR")}%
    </span>
  );
}

export function PainelLucro({ vendas }: { vendas: VendaPaga[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("6m");
  const [resumo, setResumo] = useState<{ resumo: string; passos: string[] } | null>(null);
  const [gerando, setGerando] = useState(false);
  const g = useMemo(() => agrupar(vendas, periodo), [vendas, periodo]);

  async function gerarResumo() {
    setGerando(true);
    try {
      const r = await fetch("/api/resumo-periodo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodo }) });
      const d = (await r.json().catch(() => ({}))) as { resumo?: string; passos?: string[]; erro?: string };
      if (!r.ok || !d.resumo) throw new Error(d.erro ?? "Não foi possível gerar o resumo.");
      setResumo({ resumo: d.resumo, passos: d.passos ?? [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o resumo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <section className="placa flex h-full flex-col p-5 sm:p-6" aria-labelledby="titulo-lucro">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-lucro" className="flex items-center gap-2 text-[0.95rem] font-semibold">
            <span className="size-1.5 rounded-full bg-azul shadow-[0_0_10px_#ff5a1f]" aria-hidden="true" />
            Lucro no período
          </h2>
          <div className="mt-1 flex items-center gap-2.5">
            <Contador valor={g.lucro} formato="moeda" className="font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em]" />
            <Variacao valor={g.variacaoLucro} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void gerarResumo()}
            disabled={gerando}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-gradient-to-b from-[#ff7a45] to-[#e8470f] px-4 text-sm font-semibold text-sobre-brasa shadow-[0_6px_18px_-8px_rgba(255,90,31,0.9)] hover:brightness-110 disabled:opacity-60"
          >
            {gerando ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Gerar resumo do período
          </button>
          <div className="flex max-w-full overflow-x-auto rounded-full border border-fio bg-white/[0.02] p-1 [scrollbar-width:none]" role="radiogroup" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.chave}
                type="button"
                role="radio"
                aria-checked={periodo === p.chave}
                onClick={() => {
                  setPeriodo(p.chave);
                  setResumo(null);
                }}
                className={cn("relative h-7 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", periodo === p.chave ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}
              >
                {periodo === p.chave && <motion.span layoutId="periodo-ativo" className="absolute inset-0 rounded-full bg-azul" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative">{p.rotulo}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {resumo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="heroi-escuro mt-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ciano">
                  <Sparkles className="size-3.5" /> Resumo da IA
                </p>
                <button type="button" onClick={() => setResumo(null)} aria-label="Fechar resumo" className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{resumo.resumo}</p>
              {resumo.passos.length > 0 && (
                <ol className="mt-3 space-y-1.5">
                  {resumo.passos.map((p, i) => (
                    <li key={p} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="font-display font-semibold text-ciano num">{i + 1}.</span> {p}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex-1">
        <GraficoArea pontos={g.pontos.map((p) => ({ rotulo: p.rotulo, valor: p.lucro }))} formato="moeda" altura={170} eixo cor="#ff6a2e" titulo="Lucro no período" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="rounded-full border border-fio px-3 py-1.5 text-muted-foreground">
          Ticket médio <b className="valor-sensivel font-semibold text-foreground num">{(g.ticket / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="rounded-full border border-fio px-3 py-1.5">
            Receita <b className="valor-sensivel font-semibold text-foreground num">{(g.receita / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
          </span>
          <span className="rounded-full border border-fio px-3 py-1.5">
            <b className="font-semibold text-foreground num">{g.vendas}</b> venda(s)
          </span>
        </span>
      </div>
    </section>
  );
}
