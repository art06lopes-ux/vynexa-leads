"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { interpretarConsulta } from "@/services/consulta-natural";

/**
 * "Quero encontrar…" — a busca em linguagem natural do dashboard.
 *
 * Enquanto o operador digita, o interpretador por regras (o mesmo do
 * servidor, rodando no navegador, sem custo) mostra o que entendeu em
 * chips. Ao enviar, a tela de busca abre já com os filtros e começa.
 */

const EXEMPLOS = ["Barbearias sem site em Manacapuru", "Auto detailing em California", "Imobiliárias em Portugal", "Dentistas sem site em Manaus com WhatsApp"];

export function BuscaRapida({ grande = true }: { grande?: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [exemplo, setExemplo] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setChips(texto.trim().length > 3 ? interpretarConsulta(texto).reconhecido : []), 220);
    return () => clearTimeout(id);
  }, [texto]);

  useEffect(() => {
    if (texto) return;
    const id = setInterval(() => setExemplo((e) => (e + 1) % EXEMPLOS.length), 3200);
    return () => clearInterval(id);
  }, [texto]);

  function enviar(consulta: string) {
    const q = consulta.trim();
    if (!q) return;
    router.push(`/buscar?q=${encodeURIComponent(q)}&auto=1`);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="group relative flex items-center gap-2 rounded-2xl border border-brilho/35 bg-placa/90 p-2 shadow-[0_0_0_1px_rgba(77,124,255,0.08),0_18px_50px_-24px_rgba(51,102,255,0.8)] transition-colors focus-within:border-brilho/70"
      >
        <span className="pastilha ml-1 size-9 shrink-0">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="relative min-w-0 flex-1">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Quero encontrar…"
            className={`w-full bg-transparent px-2 outline-none ${grande ? "h-11 text-base" : "h-9 text-sm"}`}
          />
          {!texto && (
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center overflow-hidden text-muted-foreground/70" aria-hidden="true">
              <span className="mr-1.5 hidden sm:inline">Quero encontrar…</span>
              <AnimatePresence mode="wait">
                <motion.span key={exemplo} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="truncate">
                  {EXEMPLOS[exemplo]}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
        </div>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.96 }}
          disabled={!texto.trim()}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(51,102,255,0.9)] transition-colors hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buscar leads <ArrowRight className="size-4" aria-hidden="true" />
        </motion.button>
      </form>

      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5">
        <AnimatePresence mode="popLayout">
          {chips.length > 0
            ? chips.map((c) => (
                <motion.span
                  layout
                  key={c}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="rounded-full border border-brilho/30 bg-azul/10 px-2.5 py-1 text-xs font-medium text-[#b9caff]"
                >
                  {c}
                </motion.span>
              ))
            : EXEMPLOS.slice(0, 3).map((e) => (
                <motion.button
                  layout
                  key={e}
                  type="button"
                  onClick={() => setTexto(e)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="cursor-pointer rounded-full border border-fio px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-brilho/40 hover:text-foreground"
                >
                  {e}
                </motion.button>
              ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
