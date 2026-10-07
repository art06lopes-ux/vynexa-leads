"use client";

import { LogOut } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Marca } from "@/components/marca";
import { cn } from "@/lib/utils";
import { sair } from "@/server/acoes-auth";

import { ativo, GRUPOS_NAV, NAV_RODAPE, type ChaveContador, type ItemNav } from "./navegacao";

export type Contadores = Partial<Record<ChaveContador, number>>;

function ItemLink({ item, contadores, aoNavegar, id }: { item: ItemNav; contadores: Contadores; aoNavegar?: () => void; id: string }) {
  const pathname = usePathname();
  const eAtivo = ativo(pathname, item.href);
  const n = item.contador ? (contadores[item.contador] ?? 0) : 0;
  const Icone = item.icone;

  return (
    <Link
      href={item.href}
      onClick={aoNavegar}
      aria-current={eAtivo ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl px-2.5 text-[0.86rem] font-medium transition-colors duration-150",
        eAtivo ? "text-white" : "text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {eAtivo && (
        // O indicador desliza entre os itens: um só elemento com layoutId.
        <motion.span
          layoutId={`nav-ativo-${id}`}
          className="absolute inset-0 rounded-xl border border-brilho/50 bg-[linear-gradient(90deg,rgba(51,102,255,0.32),rgba(51,102,255,0.08))] shadow-[0_0_22px_-8px_rgba(77,124,255,0.9)]"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
      <span className={cn("relative flex size-7 items-center justify-center rounded-lg transition-colors", eAtivo ? "pastilha" : "text-muted-foreground group-hover:text-ciano")}>
        <Icone className="size-[1.05rem]" aria-hidden="true" />
      </span>
      <span className="relative flex-1 truncate">{item.rotulo}</span>
      {n > 0 && (
        <span
          className={cn(
            "relative min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.68rem] font-semibold num",
            eAtivo ? "bg-white/15 text-white" : "bg-azul/15 text-ciano",
          )}
        >
          {n > 999 ? "999+" : n}
        </span>
      )}
    </Link>
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
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={aoNavegar} className="flex h-16 shrink-0 items-center px-4" aria-label="Ir para o dashboard">
        <Marca logoUrl={logoUrl} />
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Navegação principal">
        {GRUPOS_NAV.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1.5 px-2.5 text-[0.7rem] font-semibold text-muted-foreground/70">{grupo.titulo}</p>
            <div className="space-y-0.5">
              {grupo.itens.map((item) => (
                <ItemLink key={item.href} item={item} contadores={contadores} aoNavegar={aoNavegar} id={id} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-fio px-3 py-3">
        {NAV_RODAPE.map((item) => (
          <ItemLink key={item.href} item={item} contadores={contadores} aoNavegar={aoNavegar} id={id} />
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-fio px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-azul/20 text-sm font-semibold text-ciano">
          {responsavel.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{responsavel}</p>
          <p className="truncate text-xs text-muted-foreground">{empresa}</p>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
