"use client";

import { useEffect, useRef } from "react";

import { gsap, SEM_REDUCAO } from "@/components/motion/gsap";

/**
 * Text Scramble (guia, cat. 03): as letras mudam rápido até formar a
 * frase. É o efeito "tecnológico" da referência — e é usado com parcimônia,
 * só em rótulos curtos, porque em texto longo vira ruído.
 *
 * O servidor entrega o texto final; o efeito só embaralha depois da
 * hidratação e por 0,8s. Quem chega sem JavaScript vê o texto certo.
 */
export function TextoEmbaralhado({
  texto,
  className,
  atraso = 0,
}: {
  texto: string;
  className?: string;
  atraso?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(SEM_REDUCAO, () => {
      if (!ref.current) return;
      gsap.to(ref.current, {
        duration: 0.8,
        delay: atraso,
        scrambleText: {
          text: texto,
          chars: "01▮▯░▒▓█ABCDEF",
          speed: 0.6,
          revealDelay: 0.15,
        },
      });
    });

    return () => mm.revert();
  }, [texto, atraso]);

  return (
    <span ref={ref} className={className}>
      {texto}
    </span>
  );
}
