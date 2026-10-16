"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Menu, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Marca } from "@/components/marca";
import { cn } from "@/lib/utils";

import { ProvedorConta, type ContaShell } from "./conta-contexto";
import { BotaoDicas } from "./dicas";
import { ProvedorNotificacoes, Sino } from "./notificacoes";
import { Paleta, useAtalhoPaleta } from "./paleta";
import { ConteudoSidebar, Trilho, type Contadores } from "./sidebar";

/**
 * A moldura do painel.
 * - Desktop: trilho estreito à esquerda (ícone + nome curto).
 * - Celular: gaveta com a lista completa.
 * - Topo: busca/paleta (Ctrl+K), método de venda, AO VIVO, modo
 *   privacidade (borra os valores em R$ para mostrar a tela a alguém),
 *   atualizar, notificações e quem está logado.
 */

type Props = {
  children: React.ReactNode;
  contadores: Contadores;
  logoUrl: string | null;
  empresa: string;
  responsavel: string;
  conta: ContaShell;
};

const CHAVE_PRIVADO = "vynexa:modo-privado";

function usePrivacidade(): [boolean, () => void] {
  const [privado, setPrivado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      let salvo = false;
      try {
        salvo = localStorage.getItem(CHAVE_PRIVADO) === "1";
      } catch {
        /* navegador sem armazenamento: começa visível */
      }
      setPrivado(salvo);
      document.documentElement.classList.toggle("modo-privado", salvo);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const alternar = useCallback(() => {
    setPrivado((p) => {
      const novo = !p;
      document.documentElement.classList.toggle("modo-privado", novo);
      try {
        localStorage.setItem(CHAVE_PRIVADO, novo ? "1" : "0");
      } catch {
        /* ok */
      }
      return novo;
    });
  }, []);
  return [privado, alternar];
}

const botaoTopo = "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-fio bg-placa text-muted-foreground transition-colors hover:border-brilho/40 hover:text-foreground";

export function Shell({ children, contadores, logoUrl, empresa, responsavel, conta }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // A gaveta guarda a página em que foi aberta: trocar de página a fecha.
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const gaveta = abertaEm === pathname;
  const setGaveta = (aberta: boolean) => setAbertaEm(aberta ? pathname : null);
  const [paleta, setPaleta] = useState(false);
  const abrirPaleta = useCallback(() => setPaleta(true), []);
  useAtalhoPaleta(abrirPaleta);
  const [privado, alternarPrivado] = usePrivacidade();
  const [atualizando, iniciar] = useTransition();
  const aoVivo = pathname.startsWith("/ao-vivo");

  return (
    <ProvedorConta valor={conta}>
    <ProvedorNotificacoes logoUrl={logoUrl} empresa={empresa}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[5.75rem] shrink-0 border-r border-fio bg-sidebar lg:block">
          <Trilho contadores={contadores} id="fixa" />
        </aside>

        <AnimatePresence>
          {gaveta && (
            <>
              <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setGaveta(false)} />
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
          <header className="sticky top-0 z-30 border-b border-fio bg-background/75 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-2 px-3 sm:gap-2.5 sm:px-6">
              <button type="button" onClick={() => setGaveta(true)} aria-label="Abrir menu" className={cn(botaoTopo, "lg:hidden")}>
                <Menu className="size-5" />
              </button>
              <span className="hidden sm:inline lg:hidden">
                <Marca logoUrl={logoUrl} mostrarTexto={false} />
              </span>

              <button
                type="button"
                onClick={abrirPaleta}
                className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-fio bg-placa/80 pl-3.5 pr-2 text-left text-sm text-muted-foreground/80 transition-colors hover:border-brilho/40 md:max-w-md"
                aria-label="Procurar empresa, ir para uma tela ou criar algo (Ctrl+K)"
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 truncate">Procurar empresa, cliente ou tela…</span>
                <kbd className="hidden rounded-md bg-azul/90 px-1.5 py-0.5 text-[0.65rem] font-bold text-sobre-brasa md:block">Ctrl K</kbd>
              </button>
              <BotaoDicas />

              <div className="ml-auto flex items-center gap-2">
                {conta.recursos.includes("ao_vivo") && <Link
                  href={aoVivo ? "/" : "/ao-vivo"}
                  className={cn(
                    "hidden h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-bold sm:inline-flex",
                    aoVivo ? "border border-fio bg-placa text-foreground" : "bg-gradient-to-b from-[#ff7a45] to-[#e8470f] text-sobre-brasa shadow-[0_6px_18px_-6px_rgba(255,90,31,0.9)]",
                  )}
                  title="Sala de vendas do dia"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-current" />
                  </span>
                  AO VIVO
                </Link>}
                <button type="button" onClick={alternarPrivado} aria-pressed={privado} title={privado ? "Mostrar valores" : "Esconder valores (modo privacidade)"} aria-label={privado ? "Mostrar valores em R$" : "Esconder valores em R$"} className={cn(botaoTopo, privado && "border-brilho/50 text-ciano")}>
                  {privado ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button type="button" onClick={() => iniciar(() => router.refresh())} title="Atualizar dados" aria-label="Atualizar dados" className={cn(botaoTopo, "hidden sm:flex")}>
                  <RefreshCw className={cn("size-4", atualizando && "animate-spin")} />
                </button>
                <Sino />
                <Link href="/configuracoes" className="hidden items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-white/[0.04] xl:flex" title="Sua conta">
                  <span className="flex size-9 items-center justify-center rounded-full border border-brilho/40 bg-azul/15 text-sm font-bold text-ciano">{responsavel.charAt(0).toUpperCase()}</span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{responsavel}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">{empresa}</span>
                  </span>
                </Link>
              </div>
            </div>
          </header>
          {conta.aviso && (
            <Link
              href="/assinatura"
              className={cn(
                "block border-b px-4 py-2 text-center text-[0.8rem] font-medium sm:px-6",
                conta.aviso.tom === "alerta" ? "border-perigo/30 bg-perigo/10 text-perigo" : "border-brilho/25 bg-azul/10 text-ciano",
              )}
            >
              {conta.aviso.texto} <span className="underline underline-offset-2">Ver planos</span>
            </Link>
          )}

          <main className="w-full min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7">
            <div className="mx-auto w-full max-w-[92rem]">{children}</div>
          </main>
        </div>
      </div>
      <Paleta aberta={paleta} aoFechar={() => setPaleta(false)} />
    </ProvedorNotificacoes>
    </ProvedorConta>
  );
}
