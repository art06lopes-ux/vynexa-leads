"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, SEM_REDUCAO, SUAVE } from "@/components/motion/gsap";

/**
 * Entrada em cascata — Fade In + Slide In + Stagger (guia: combinação
 * "Visual limpo").
 *
 * Anima os filhos diretos marcados com `data-entrada`, um após o outro.
 * Só na montagem, e só para cima 14px: o suficiente para dar vida à
 * página sem atrasar a leitura do dado, que é o que importa num painel.
 *
 * `useLayoutEffect` e não `useEffect`: o estado inicial (opacidade 0)
 * precisa ser aplicado antes da primeira pintura, senão o conteúdo pisca
 * visível e depois some para entrar — o oposto do efeito.
 */
export function Entrada({
  children,
  className,
  atraso = 0,
}: {
  children: ReactNode;
  className?: string;
  atraso?: number;
}) {
  const raiz = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(SEM_REDUCAO, () => {
      const alvos = raiz.current?.querySelectorAll("[data-entrada]");
      if (!alvos || alvos.length === 0) return;

      gsap.from(alvos, {
        opacity: 0,
        y: 14,
        duration: 0.55,
        ease: SUAVE,
        stagger: 0.07,
        delay: atraso,
        clearProps: "transform",
      });
    });

    return () => mm.revert();
  }, [atraso]);

  return (
    <div ref={raiz} className={className}>
      {children}
    </div>
  );
}
