"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleDollarSign,
  Flame,
  Mail,
  Megaphone,
  Reply,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { haQuantoTempo } from "@/services/crm";
import { cn } from "@/lib/utils";

import { ToastVenda, type DadosVendaToast } from "./toast-venda";

/**
 * Central de notificações, "quase em tempo real".
 *
 * A Vercel não mantém conexão aberta (sem WebSocket no plano gratuito),
 * então o navegador pergunta a cada 12 segundos — só com a aba visível —
 * se chegou algo depois da última notificação vista. Uma venda nova
 * dispara o toast grande; resposta de lead e erro de campanha, um aviso
 * discreto.
 */

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  dados: string | null;
  lida_em: string | null;
  criado_em: string;
};

type Estado = {
  itens: Notificacao[];
  naoLidas: number;
  marcarLidas: (ids?: string[]) => Promise<void>;
  recarregar: () => Promise<void>;
};

const Contexto = createContext<Estado | null>(null);

export function useNotificacoes(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error("useNotificacoes fora do provedor.");
  return c;
}

const INTERVALO_MS = 12_000;

export function ProvedorNotificacoes({ children, logoUrl, empresa }: { children: React.ReactNode; logoUrl: string | null; empresa: string }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [venda, setVenda] = useState<DadosVendaToast | null>(null);
  const ultimaVista = useRef<string | null>(null);
  const router = useRouter();

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch("/api/notificacoes?limite=30", { cache: "no-store" });
      if (!r.ok) return;
      const dados = (await r.json()) as { itens: Notificacao[]; naoLidas: number };
      setItens(dados.itens);
      setNaoLidas(dados.naoLidas);

      const maisNova = dados.itens[0]?.criado_em ?? null;
      if (ultimaVista.current === null) {
        // Primeira carga: o que já existia não vira toast.
        ultimaVista.current = maisNova ?? "0";
        return;
      }
      const novas = dados.itens.filter((n) => n.criado_em > (ultimaVista.current ?? "")).reverse();
      if (maisNova) ultimaVista.current = maisNova;

      for (const n of novas) {
        if (n.tipo === "venda" && n.dados) {
          try {
            setVenda(JSON.parse(n.dados) as DadosVendaToast);
          } catch {
            /* dados malformados: o sino ainda mostra */
          }
        } else if (["resposta", "erro_campanha", "campanha_concluida", "oportunidade", "busca_concluida"].includes(n.tipo)) {
          toast(n.titulo, {
            description: n.corpo ?? undefined,
            action: n.link ? { label: "Abrir", onClick: () => router.push(n.link!) } : undefined,
          });
        }
      }
      // Venda, pagamento e resposta mudam números da tela atual.
      if (novas.some((n) => ["venda", "pagamento", "resposta"].includes(n.tipo))) router.refresh();
    } catch {
      /* rede caiu: tenta de novo no próximo ciclo */
    }
  }, [router]);

  useEffect(() => {
    const primeira = setTimeout(() => void recarregar(), 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, INTERVALO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && void recarregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [recarregar]);

  const marcarLidas = useCallback(
    async (ids?: string[]) => {
      setItens((atual) => atual.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida_em: n.lida_em ?? new Date().toISOString() } : n)));
      setNaoLidas((n) => (ids ? Math.max(0, n - ids.length) : 0));
      await fetch("/api/notificacoes/lidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { todas: true }),
      }).catch(() => {});
    },
    [],
  );

  return (
    <Contexto.Provider value={{ itens, naoLidas, marcarLidas, recarregar }}>
      {children}
      <ToastVenda venda={venda} aoFechar={() => setVenda(null)} logoUrl={logoUrl} empresa={empresa} />
    </Contexto.Provider>
  );
}

export const ICONE_NOTIFICACAO: Record<string, LucideIcon> = {
  venda: CircleDollarSign,
  pagamento: CircleDollarSign,
  resposta: Reply,
  email_enviado: Mail,
  erro_campanha: CircleAlert,
  oportunidade: Flame,
  campanha_concluida: Megaphone,
  busca_concluida: Search,
};

export const COR_NOTIFICACAO: Record<string, string> = {
  venda: "text-sucesso bg-sucesso/12",
  pagamento: "text-sucesso bg-sucesso/12",
  erro_campanha: "text-perigo bg-perigo/12",
  oportunidade: "text-aviso bg-aviso/12",
};

export function ItemNotificacao({ n, aoClicar }: { n: Notificacao; aoClicar?: () => void }) {
  const Icone = ICONE_NOTIFICACAO[n.tipo] ?? Bell;
  const conteudo = (
    <div className={cn("flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]", !n.lida_em && "bg-azul/[0.06]")}>
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", COR_NOTIFICACAO[n.tipo] ?? "bg-azul/12 text-ciano")}>
        <Icone className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{n.titulo}</p>
          {!n.lida_em && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ciano" aria-label="Não lida" />}
        </div>
        {n.corpo && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.corpo}</p>}
        <p className="mt-1 text-[0.7rem] text-muted-foreground/70">{haQuantoTempo(n.criado_em)}</p>
      </div>
    </div>
  );
  return n.link ? (
    <Link href={n.link} onClick={aoClicar} className="block">
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={aoClicar} className="block w-full text-left">
      {conteudo}
    </button>
  );
}

export function Sino() {
  const { itens, naoLidas, marcarLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setAberto((a) => !a)}
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : "Notificações"}
        aria-expanded={aberto}
        className="pastilha relative size-10 cursor-pointer"
      >
        <Bell className="size-[1.1rem]" />
        <AnimatePresence>
          {naoLidas > 0 && (
            <motion.span
              key={naoLidas}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full border-2 border-background bg-perigo px-1 text-[0.65rem] font-bold text-white num"
            >
              {naoLidas > 99 ? "99+" : naoLidas}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-fio bg-popover shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between border-b border-fio px-4 py-3">
              <p className="font-display text-sm font-semibold">Notificações</p>
              {naoLidas > 0 && (
                <button type="button" onClick={() => marcarLidas()} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-ciano hover:underline">
                  <CheckCheck className="size-3.5" /> Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-[26rem] space-y-0.5 overflow-y-auto p-2">
              {itens.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação ainda. Vendas, respostas e campanhas aparecem aqui.</p>
              ) : (
                itens.slice(0, 12).map((n) => (
                  <ItemNotificacao
                    key={n.id}
                    n={n}
                    aoClicar={() => {
                      if (!n.lida_em) void marcarLidas([n.id]);
                      setAberto(false);
                    }}
                  />
                ))
              )}
            </div>
            <Link href="/notificacoes" onClick={() => setAberto(false)} className="block border-t border-fio px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground">
              Ver todas
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
