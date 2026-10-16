"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Plus, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { useConta } from "./conta-contexto";
import { TODOS_ITENS, visivel } from "./navegacao";

/**
 * Paleta de comandos (Ctrl+K ou ⌘K): ir para qualquer tela, criar venda,
 * cliente ou projeto, e achar uma empresa pelo nome ou telefone — sem
 * tirar a mão do teclado.
 */

type Opcao = { id: string; rotulo: string; dica?: string; grupo: string; href: string; icone: React.ComponentType<{ className?: string }> };

const ACOES: Opcao[] = [
  { id: "nova-venda", rotulo: "Registrar venda", grupo: "Criar", href: "/pagamentos?nova=1", icone: Plus },
  { id: "novo-cliente", rotulo: "Novo cliente", grupo: "Criar", href: "/clientes?novo=1", icone: Plus },
  { id: "novo-projeto", rotulo: "Novo projeto / site", grupo: "Criar", href: "/sites?novo=1", icone: Plus },
  { id: "novo-prompt", rotulo: "Gerar um prompt", grupo: "Criar", href: "/prompts", icone: Plus },
  { id: "radar", rotulo: "Mapear empresas no Radar", grupo: "Criar", href: "/buscar", icone: Plus },
];

export function useAtalhoPaleta(abrir: () => void) {
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.code === "Space")) {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, [abrir]);
}

export function Paleta({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [leads, setLeads] = useState<Opcao[]>([]);
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const { ehDono } = useConta();
  const navegacao: Opcao[] = useMemo(
    () => TODOS_ITENS.filter((i) => visivel(i, ehDono)).map((i) => ({ id: `ir-${i.href}`, rotulo: i.rotulo, grupo: "Ir para", href: i.href, icone: i.icone })).concat([{ id: "ir-ao-vivo", rotulo: "Sala de vendas ao vivo", grupo: "Ir para", href: "/ao-vivo", icone: ArrowRight }]),
    [ehDono],
  );

  // Busca de empresas, com uma pausa curta entre as teclas.
  useEffect(() => {
    const q = texto.trim();
    if (!aberta || q.length < 2) {
      const t = setTimeout(() => setLeads([]), 0);
      return () => clearTimeout(t);
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/leads?q=${encodeURIComponent(q)}&porPagina=6`, { signal: ctl.signal });
        const d = (await r.json()) as { itens?: Array<{ lead_id: string; nome: string; cidade: string | null }> };
        setLeads((d.itens ?? []).map((l) => ({ id: l.lead_id, rotulo: l.nome, dica: l.cidade ?? undefined, grupo: "Empresas", href: `/leads/${l.lead_id}`, icone: Users })));
      } catch {
        /* digitou de novo: a busca anterior foi cancelada */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [texto, aberta]);

  const filtro = texto.trim().toLowerCase();
  const opcoes = useMemo(() => {
    const casam = (o: Opcao) => !filtro || o.rotulo.toLowerCase().includes(filtro);
    return [...leads, ...ACOES.filter(casam), ...navegacao.filter(casam)];
  }, [leads, filtro, navegacao]);

  const ir = useCallback(
    (o: Opcao | undefined) => {
      if (!o) return;
      aoFechar();
      setTexto("");
      router.push(o.href);
    },
    [aoFechar, router],
  );

  useEffect(() => {
    if (!aberta) return;
    const t = setTimeout(() => {
      setIndice(0);
      campo.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [aberta]);

  let grupoAnterior = "";

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={aoFechar}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -10, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, scale: 0.98 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-fio bg-[#16120f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center gap-3 border-b border-fio px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={campo}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setIndice(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") aoFechar();
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndice((i) => Math.min(i + 1, opcoes.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndice((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    ir(opcoes[indice]);
                  }
                }}
                placeholder="Ir para, criar ou procurar empresa…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
                aria-label="Comando ou empresa"
              />
              <kbd className="rounded-md border border-fio px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {opcoes.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado para “{texto}”.</li>}
              {opcoes.map((o, i) => {
                const titulo = o.grupo !== grupoAnterior ? o.grupo : null;
                grupoAnterior = o.grupo;
                const Icone = o.icone;
                return (
                  <li key={o.id} role="option" aria-selected={i === indice}>
                    {titulo && <p className="px-3 pb-1 pt-2 text-[0.7rem] font-semibold text-muted-foreground">{titulo}</p>}
                    <button
                      type="button"
                      onMouseEnter={() => setIndice(i)}
                      onClick={() => ir(o)}
                      className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === indice ? "bg-azul/15 text-foreground" : "text-foreground/85")}
                    >
                      <Icone className={cn("size-4", i === indice ? "text-ciano" : "text-muted-foreground")} />
                      <span className="flex-1 truncate">{o.rotulo}</span>
                      {o.dica && <span className="text-xs text-muted-foreground">{o.dica}</span>}
                      {i === indice && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
