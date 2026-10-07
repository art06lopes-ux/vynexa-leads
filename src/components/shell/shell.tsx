"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Marca } from "@/components/marca";

import { ProvedorNotificacoes, Sino } from "./notificacoes";
import { ConteudoSidebar, type Contadores } from "./sidebar";

/**
 * A moldura do painel: sidebar fixa no desktop, gaveta no celular, barra
 * do topo com busca (⌘K / Ctrl+K), sino e relógio.
 */

type Props = {
  children: React.ReactNode;
  contadores: Contadores;
  logoUrl: string | null;
  empresa: string;
  responsavel: string;
};

function Relogio() {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const atualizar = () => setHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    atualizar();
    const id = setInterval(atualizar, 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="ao-vivo hidden h-10 items-center gap-2 rounded-xl border border-fio bg-placa px-3 text-sm font-semibold num sm:inline-flex" title="Dados ao vivo">
      {hora ?? "--:--"}
    </span>
  );
}

function BuscaTopo() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = texto.trim();
        if (q) router.push(`/leads?q=${encodeURIComponent(q)}`);
      }}
      className="relative flex-1 md:max-w-md"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar leads, empresas, telefones…"
        aria-label="Buscar na carteira"
        className="h-10 w-full rounded-xl border border-fio bg-placa/80 pl-10 pr-14 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brilho/60 focus:bg-placa"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-fio bg-white/5 px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground md:block">
        Ctrl K
      </kbd>
    </form>
  );
}

export function Shell({ children, contadores, logoUrl, empresa, responsavel }: Props) {
  const pathname = usePathname();
  // A gaveta guarda a página em que foi aberta: trocar de página (link,
  // voltar do navegador) a fecha sem precisar de efeito.
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const gaveta = abertaEm === pathname;
  const setGaveta = (aberta: boolean) => setAbertaEm(aberta ? pathname : null);

  return (
    <ProvedorNotificacoes logoUrl={logoUrl} empresa={empresa}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 border-r border-fio bg-sidebar/80 backdrop-blur-xl lg:block">
          <ConteudoSidebar contadores={contadores} logoUrl={logoUrl} empresa={empresa} responsavel={responsavel} id="fixa" />
        </aside>

        <AnimatePresence>
          {gaveta && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setGaveta(false)}
              />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 w-[17rem] border-r border-fio bg-sidebar lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                aria-label="Menu"
              >
                <button type="button" onClick={() => setGaveta(false)} aria-label="Fechar menu" className="absolute right-3 top-4 z-10 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5">
                  <X className="size-5" />
                </button>
                <ConteudoSidebar contadores={contadores} logoUrl={logoUrl} empresa={empresa} responsavel={responsavel} aoNavegar={() => setGaveta(false)} id="gaveta" />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-fio bg-background/70 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button type="button" onClick={() => setGaveta(true)} aria-label="Abrir menu" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-fio bg-placa lg:hidden">
                <Menu className="size-5" />
              </button>
              <span className="lg:hidden">
                <Marca logoUrl={logoUrl} mostrarTexto={false} />
              </span>
              <BuscaTopo />
              <div className="ml-auto flex items-center gap-2.5">
                <Sino />
                <Relogio />
              </div>
            </div>
          </header>

          <main className="w-full min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
            <div className="mx-auto w-full max-w-[90rem]">{children}</div>
          </main>
        </div>
      </div>
    </ProvedorNotificacoes>
  );
}
