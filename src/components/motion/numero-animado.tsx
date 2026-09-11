"use client";

import { useEffect, useRef, useState } from "react";

import { gsap, SEM_REDUCAO } from "@/components/motion/gsap";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

/**
 * Animated Counter (guia, cat. 04): o número sobe até o valor final.
 *
 * Renderiza o valor final no servidor — quem vê a página sem JavaScript,
 * ou com "reduzir movimento", lê o número certo de imediato. A animação
 * só substitui o texto a partir do zero depois da hidratação.
 *
 * `formato` é uma string, e não uma função, de propósito: este componente
 * é cliente e é renderizado por Server Components. Função não atravessa
 * essa fronteira — o erro em produção foi exatamente "Functions cannot be
 * passed directly to Client Components". Só dado serializável passa.
 */
export type FormatoNumero = "inteiro" | "compacto" | "dinheiro";

function formatar(v: number, formato: FormatoNumero): string {
  const n = Math.round(v);
  switch (formato) {
    case "dinheiro":
      return formatarDinheiro(n);
    case "compacto":
      // "12,4 mil" cabe no cartão; "12.438" quebra a linha no celular.
      return n < 1000
        ? String(n)
        : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
    default:
      return n.toLocaleString("pt-BR");
  }
}

export function NumeroAnimado({
  valor,
  formato = "inteiro",
  duracao = 1.1,
  className,
}: {
  valor: number;
  formato?: FormatoNumero;
  duracao?: number;
  className?: string;
}) {
  const [texto, setTexto] = useState(() => formatar(valor, formato));
  const anterior = useRef(0);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(SEM_REDUCAO, () => {
      const objeto = { v: anterior.current };
      gsap.to(objeto, {
        v: valor,
        duration: duracao,
        ease: "power2.out",
        onUpdate: () => setTexto(formatar(objeto.v, formato)),
        onComplete: () => {
          anterior.current = valor;
          setTexto(formatar(valor, formato));
        },
      });
    });

    // Sem animação, o texto final é aplicado direto.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      setTexto(formatar(valor, formato));
    });

    return () => mm.revert();
  }, [valor, duracao, formato]);

  return <span className={className}>{texto}</span>;
}
