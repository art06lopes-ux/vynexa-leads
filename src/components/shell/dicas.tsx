"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * "Antes de abordar, leia isto": o método de venda da Vynexa em seis
 * cartazes. Fica a um clique no topo de todas as telas — é o lembrete
 * que mais muda resultado, então não pode morar escondido num manual.
 */

const DICAS = [
  { titulo: "Estude a empresa antes de abordar.", corpo: "Abra o Instagram, veja as avaliações no Google e o que falta. Uma frase específica vale mais que um texto bonito." },
  { titulo: "Mostre, não descreva.", corpo: "Uma prévia do site com o nome e as fotos do cliente fecha mais do que qualquer explicação. Ofereça a prévia sem compromisso." },
  { titulo: "Áudio curto abre portas.", corpo: "Depois da primeira mensagem, um áudio de 30 segundos, natural, aumenta muito a chance de resposta." },
  { titulo: "Siga até a sétima vez.", corpo: "Quem mostrou interesse e sumiu ainda pode fechar. Retome com educação a cada poucos dias — use “Para retomar” em Leads." },
  { titulo: "Um problema, uma solução.", corpo: "Não ofereça tudo. Sem site? Site. Site fraco? Site novo. Atendimento bagunçado? Sistema de agendamento." },
  { titulo: "Feche com data e próximo passo.", corpo: "Toda conversa termina com algo marcado: enviar a prévia amanhã, ligar na quinta, cobrança com vencimento." },
];

export function BotaoDicas() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Método de venda da Vynexa"
        aria-label="Abrir o método de venda"
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] text-sobre-brasa shadow-[0_6px_18px_-6px_rgba(255,90,31,0.9)] hover:brightness-110"
      >
        <Flame className="size-[1.1rem]" />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAberto(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-dicas"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="titulo-dicas" className="text-xl font-semibold sm:text-2xl">
                  Quer vender? Aplique isto em cada abordagem.
                </h2>
                <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-fio bg-placa hover:bg-white/10">
                  <X className="size-4" />
                </button>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DICAS.map((d, i) => (
                  <motion.li
                    key={d.titulo}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className={i % 3 === 1 ? "heroi flex min-h-52 flex-col justify-between p-6" : "heroi-escuro flex min-h-52 flex-col justify-between p-6"}
                  >
                    <span className="font-display text-sm font-semibold text-white/70 num">0{i + 1}</span>
                    <div>
                      <p className="font-display text-[1.45rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white">{d.titulo}</p>
                      <p className="mt-3 text-sm leading-relaxed text-white/85">{d.corpo}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
