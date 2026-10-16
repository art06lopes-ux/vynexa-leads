"use client";

import { motion } from "framer-motion";
import { Lock, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Marca, MonogramaProvisorio } from "@/components/marca";
import { cn } from "@/lib/utils";
import { sair } from "@/server/acoes-auth";

import { useConta } from "./conta-contexto";
import { ativo, GRUPOS_NAV, NAV_RODAPE, visivel, type ChaveContador, type ItemNav } from "./navegacao";

export type Contadores = Partial<Record<ChaveContador, number>>;

/**
 * Navegação em dois formatos:
 * - trilho (desktop): coluna estreita, ícone com o nome curto embaixo —
 *   o conteúdo ganha a largura, e nada fica escondido atrás de tooltip;
 * - lista (gaveta do celular): ícone + nome completo + contador.
 */

function Contador({ n, ativoItem, compacto }: { n: number; ativoItem: boolean; compacto?: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "min-w-[1.1rem] rounded-full px-1 text-center text-[0.62rem] font-bold leading-4 num",
        compacto ? "absolute -right-1 -top-1" : "relative ml-auto",
        ativoItem ? "bg-white text-sobre-brasa" : "bg-azul text-sobre-brasa",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** A tela é de um plano acima do atual: o item fica, com cadeado (leva à explicação). */
function useTravado(item: ItemNav): boolean {
  const { recursos } = useConta();
  return Boolean(item.recurso && !recursos.includes(item.recurso));
}

function ItemTrilho({ item, contadores, id }: { item: ItemNav; contadores: Contadores; id: string }) {
  const pathname = usePathname();
  const eAtivo = ativo(pathname, item);
  const n = item.contador ? (contadores[item.contador] ?? 0) : 0;
  const Icone = item.icone;
  const travado = useTravado(item);
  return (
    <Link href={item.href} aria-current={eAtivo ? "page" : undefined} title={travado ? `${item.rotulo} (outro plano)` : item.rotulo} className="group flex flex-col items-center gap-0.5 py-0.5">
      <span className={cn("relative flex size-9 items-center justify-center rounded-xl transition-colors", eAtivo ? "text-sobre-brasa" : "text-sidebar-foreground/70 group-hover:bg-white/[0.06] group-hover:text-white")}>
        {eAtivo && (
          <motion.span
            layoutId={`trilho-ativo-${id}`}
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] shadow-[0_8px_24px_-8px_rgba(255,90,31,0.9)]"
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
          />
        )}
        <Icone className={cn("relative size-[1.1rem]", travado && "opacity-50")} aria-hidden="true" />
        {travado ? <Lock className="absolute -right-0.5 -top-0.5 size-3 text-muted-foreground" aria-label="Disponível em outro plano" /> : <Contador n={n} ativoItem={eAtivo} compacto />}
      </span>
      <span className={cn("text-[0.64rem] font-semibold leading-none", eAtivo ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{item.curto}</span>
    </Link>
  );
}

function ItemLista({ item, contadores, aoNavegar, id }: { item: ItemNav; contadores: Contadores; aoNavegar?: () => void; id: string }) {
  const pathname = usePathname();
  const eAtivo = ativo(pathname, item);
  const n = item.contador ? (contadores[item.contador] ?? 0) : 0;
  const Icone = item.icone;
  const travado = useTravado(item);
  return (
    <Link
      href={item.href}
      onClick={aoNavegar}
      aria-current={eAtivo ? "page" : undefined}
      className={cn("relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9rem] font-medium", eAtivo ? "text-sobre-brasa" : "text-sidebar-foreground/85 hover:bg-white/[0.04]")}
    >
      {eAtivo && <motion.span layoutId={`lista-ativo-${id}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ff6a2e] to-[#e8470f]" transition={{ type: "spring", stiffness: 460, damping: 36 }} />}
      <Icone className="relative size-[1.1rem]" aria-hidden="true" />
      <span className={cn("relative", travado && "opacity-60")}>{item.rotulo}</span>
      {travado ? <Lock className="relative ml-auto size-3.5 text-muted-foreground" aria-label="Disponível em outro plano" /> : <Contador n={n} ativoItem={eAtivo} />}
    </Link>
  );
}

export function Trilho({ contadores, id }: { contadores: Contadores; id: string }) {
  const { ehDono } = useConta();
  return (
    <div className="flex h-full flex-col items-center py-3">
      <Link href="/" aria-label="Ir para o Início" className="mb-3">
        <MonogramaProvisorio className="size-9" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto [scrollbar-width:none]" aria-label="Navegação principal">
        {GRUPOS_NAV.map((g, i) => (
          <div key={g.titulo} className="flex flex-col items-center">
            {i > 0 && <span className="my-1.5 h-px w-8 bg-fio" aria-hidden="true" />}
            {g.itens.filter((item) => visivel(item, ehDono)).map((item) => (
              <ItemTrilho key={item.href} item={item} contadores={contadores} id={id} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-2 flex flex-col items-center border-t border-fio pt-2">
        {NAV_RODAPE.filter((item) => visivel(item, ehDono)).map((item) => (
          <ItemTrilho key={item.href} item={item} contadores={contadores} id={id} />
        ))}
        <form action={sair}>
          <button type="submit" className="mt-1 flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function ConteudoSidebar({
  contadores,
  logoUrl,
  empresa,
  responsavel,
  aoNavegar,
  id,
}: {
  contadores: Contadores;
  logoUrl: string | null;
  empresa: string;
  responsavel: string;
  aoNavegar?: () => void;
  id: string;
}) {
  const { ehDono } = useConta();
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={aoNavegar} className="flex h-16 shrink-0 items-center px-4" aria-label="Ir para o Início">
        <Marca logoUrl={logoUrl} />
      </Link>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2" aria-label="Navegação principal">
        {GRUPOS_NAV.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1 px-3 text-[0.7rem] font-semibold text-muted-foreground/70">{grupo.titulo}</p>
            <div className="space-y-0.5">
              {grupo.itens.filter((item) => visivel(item, ehDono)).map((item) => (
                <ItemLista key={item.href} item={item} contadores={contadores} aoNavegar={aoNavegar} id={id} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-fio px-3 py-3">
        {NAV_RODAPE.filter((item) => visivel(item, ehDono)).map((item) => (
          <ItemLista key={item.href} item={item} contadores={contadores} aoNavegar={aoNavegar} id={id} />
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-fio px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-azul/20 text-sm font-semibold text-ciano">{responsavel.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{responsavel}</p>
          <p className="truncate text-xs text-muted-foreground">{empresa}</p>
        </div>
        <form action={sair}>
          <button type="submit" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
