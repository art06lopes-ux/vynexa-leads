"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  History,
  LayoutDashboard,
  Radar,
  Settings,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dock flutuante, no rodapé, no lugar do trilho lateral.
 *
 * Devolve a largura inteira ao conteúdo — numa tabela de seis colunas
 * isso é espaço que faz diferença de verdade — e mantém a navegação ao
 * alcance do polegar no celular, onde o topo é a parte mais difícil de
 * alcançar.
 *
 * `position: fixed` cobre o rodapé da página, então o `<main>` reserva
 * espaço embaixo. Sem isso a última linha da tabela ficaria escondida
 * atrás do dock — o tipo de defeito que só aparece quando a lista é
 * longa o bastante.
 */

const ITENS = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard },
  { href: "/buscar", rotulo: "Caçar", Icone: Radar },
  { href: "/empresas", rotulo: "Empresas", Icone: Building2 },
  { href: "/vendas", rotulo: "Vendas", Icone: Wallet },
  { href: "/historico", rotulo: "Histórico", Icone: History },
  { href: "/ajustes", rotulo: "Ajustes", Icone: Settings },
] as const;

export function Dock() {
  const caminho = usePathname();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
      // Faixa de gestos do iPhone: sem isto o dock encosta na barra do
      // sistema e o toque no item do meio vira "voltar à tela inicial".
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <nav
        aria-label="Seções"
        className="vidro pointer-events-auto flex items-end gap-1 rounded-2xl p-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]"
      >
        {ITENS.map(({ href, rotulo, Icone }) => {
          // Exato na raiz, prefixo nas demais: sem isso "/" ficaria aceso
          // em todas as páginas.
          const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              title={rotulo}
              className={cn(
                "group relative flex h-14 w-[3.25rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[0.6rem] font-medium transition-all duration-200 sm:w-[4.25rem] sm:text-[0.65rem]",
                ativo
                  ? "bg-primary/18 text-foreground"
                  : "text-muted-foreground hover:-translate-y-1 hover:bg-accent hover:text-foreground",
              )}
            >
              <Icone
                className={cn("size-5 transition-transform duration-200", ativo && "drop-shadow-[0_0_8px_var(--primary)]")}
                aria-hidden="true"
              />
              {rotulo}

              {/* Ponto embaixo do item ativo, como no dock do macOS. É o
                  reforço não-cromático do estado: quem não distingue o
                  vermelho ainda vê qual está aberto. */}
              {ativo && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 size-1 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
