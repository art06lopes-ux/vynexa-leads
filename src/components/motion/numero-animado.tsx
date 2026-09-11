"use client";

import { useEffect, useRef, useState } from "react";

import { gsap, SEM_REDUCAO } from "@/components/motion/gsap";

/**
 * Animated Counter (guia, cat. 04): o número sobe até o valor final.
 *
 * Renderiza o valor final no servidor — quem vê a página sem JavaScript,
 * ou com "reduzir movimento", lê o número certo de imediato. A animação
 * só substitui o texto a partir do zero depois da hidratação.
 *
 * `formatar` recebe o valor bruto a cada quadro, então serve tanto para
 * "1.284" quanto para "R$ 1.297,00": quem chama decide a máscara.
 */
export function NumeroAnimado({
  valor,
  formatar,
  duracao = 1.1,
  className,
}: {
  valor: number;
  formatar: (v: number) => string;
  duracao?: number;
  className?: string;
}) {
  const [texto, setTexto] = useState(() => formatar(valor));
  const anterior = useRef(0);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(SEM_REDUCAO, () => {
      const objeto = { v: anterior.current };
      gsap.to(objeto, {
        v: valor,
        duration: duracao,
        ease: "power2.out",
        onUpdate: () => setTexto(formatar(objeto.v)),
        onComplete: () => {
          anterior.current = valor;
          setTexto(formatar(valor));
        },
      });
    });

    // Sem animação, o texto final é aplicado direto.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      setTexto(formatar(valor));
    });

    return () => mm.revert();
  }, [valor, duracao, formatar]);

  return <span className={className}>{texto}</span>;
}
