"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Search } from "lucide-react";

import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard },
  { href: "/buscar", rotulo: "Buscar", Icone: Search },
  { href: "/empresas", rotulo: "Empresas", Icone: Building2 },
] as const;

export function Navegacao() {
  const caminho = usePathname();

  return (
    <nav aria-label="Seções" className="flex items-center gap-1">
      {ITENS.map(({ href, rotulo, Icone }) => {
        // Comparação exata na raiz, prefixo nas demais: sem isso "/" ficaria
        // marcado como ativo em todas as páginas.
        const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-200",
              ativo
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icone className="size-4" aria-hidden="true" />
            {/* No celular sobra só o ícone; o rótulo continua no leitor de tela. */}
            <span className="hidden sm:inline">{rotulo}</span>
            <span className="sr-only sm:hidden">{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
