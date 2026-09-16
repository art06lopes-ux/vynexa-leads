"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import {
  Building2,
  Filter,
  History,
  LayoutDashboard,
  Mail,
  Radar,
  Settings,
  Wallet,
} from "lucide-react";

import { ELASTICO, gsap } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/**
 * Dock flutuante com magnificação de macOS.
 *
 * O ícone sob o ponteiro cresce, os vizinhos crescem menos, e o resto
 * fica no lugar — Hover Animation + Scale Up + Elastic do guia. A escala
 * é calculada pela distância horizontal do ponteiro a cada item, o que
 * dá a curva contínua do macOS em vez de um "pula quando entra".
 *
 * Só com ponteiro fino: no toque não existe hover, e um item preso em
 * escala 1,5 depois do dedo sair ficaria errado. Lá o dock é estático.
 *
 * `position: fixed` cobre o rodapé, então o `<main>` reserva espaço.
 */

const ITENS = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard },
  { href: "/buscar", rotulo: "Caçar", Icone: Radar },
  { href: "/empresas", rotulo: "Empresas", Icone: Building2 },
  { href: "/funil", rotulo: "Funil", Icone: Filter },
  { href: "/vendas", rotulo: "Vendas", Icone: Wallet },
  { href: "/campanhas", rotulo: "Campanhas", Icone: Mail },
  { href: "/historico", rotulo: "Histórico", Icone: History },
  { href: "/ajustes", rotulo: "Ajustes", Icone: Settings },
] as const;

/** Alcance da magnificação em px e escala máxima no centro. */
const ALCANCE = 110;
const ESCALA_MAX = 1.45;

export function Dock() {
  const caminho = usePathname();
  const itens = useRef<Array<HTMLAnchorElement | null>>([]);
  const ponteiroFino = useRef<boolean | null>(null);

  const temPonteiroFino = () => {
    if (ponteiroFino.current === null) {
      ponteiroFino.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    }
    return ponteiroFino.current;
  };

  const aoMover = useCallback((evento: React.MouseEvent) => {
    if (!temPonteiroFino()) return;
    const x = evento.clientX;

    for (const el of itens.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const centro = r.left + r.width / 2;
      const d = Math.abs(x - centro);
      // Curva de sino: 1 no centro, 0 fora do alcance.
      const fator = d > ALCANCE ? 0 : Math.cos((d / ALCANCE) * (Math.PI / 2));
      const escala = 1 + (ESCALA_MAX - 1) * fator;

      gsap.to(el, {
        scale: escala,
        y: -12 * fator,
        duration: 0.18,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, []);

  const aoSair = useCallback(() => {
    if (!temPonteiroFino()) return;
    gsap.to(itens.current.filter(Boolean), {
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: ELASTICO,
      overwrite: "auto",
    });
  }, []);

  /** Microinteraction (guia, cat. 04): um "tap" curto ao clicar. */
  const aoClicar = useCallback((el: HTMLAnchorElement | null) => {
    if (!el) return;
    gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.45, ease: ELASTICO });
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      // Faixa de gestos do iPhone: sem isto o dock encosta na barra do
      // sistema e o toque no item do meio vira "voltar à tela inicial".
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <nav
        aria-label="Seções"
        onMouseMove={aoMover}
        onMouseLeave={aoSair}
        className="vidro brasa pointer-events-auto flex items-end gap-1 rounded-2xl px-2 pb-2 pt-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]"
      >
        {ITENS.map(({ href, rotulo, Icone }, i) => {
          // Exato na raiz, prefixo nas demais: sem isso "/" ficaria aceso
          // em todas as páginas.
          const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              ref={(el) => {
                itens.current[i] = el;
              }}
              onClick={() => aoClicar(itens.current[i] ?? null)}
              aria-current={ativo ? "page" : undefined}
              title={rotulo}
              // `origin-bottom`: cresce para cima, como no macOS, e não
              // para os dois lados empurrando os vizinhos.
              className={cn(
                "group relative flex h-14 w-[2.9rem] origin-bottom cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[0.6rem] font-medium will-change-transform sm:w-[4.25rem] sm:text-[0.65rem]",
                ativo ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone
                className={cn(
                  "size-5",
                  ativo && "text-acento",
                )}
                aria-hidden="true"
              />
              {rotulo}

              {/* Ponto embaixo do item ativo, como no dock do macOS. É o
                  reforço não-cromático do estado: quem não distingue o
                  vermelho ainda vê qual está aberto. */}
              {ativo && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 size-1 rounded-full bg-acento"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
