"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Número que sobe suavemente até o valor real.
 *
 * O formato vem como NOME (e não como função): componente de servidor
 * não pode passar função para componente de cliente — quebra em produção
 * ("Functions cannot be passed to Client Components").
 */
export type FormatoNumero = "inteiro" | "moeda" | "percentual" | "decimal";

export function formatar(valor: number, formato: FormatoNumero, moeda = "BRL"): string {
  switch (formato) {
    case "moeda":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda, maximumFractionDigits: valor >= 100_000 * 100 ? 0 : 2 }).format(valor / 100);
    case "percentual":
      return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "decimal":
      return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    default:
      return Math.round(valor).toLocaleString("pt-BR");
  }
}

export function Contador({
  valor,
  formato = "inteiro",
  moeda = "BRL",
  className,
  duracao = 1.1,
}: {
  valor: number;
  formato?: FormatoNumero;
  moeda?: string;
  className?: string;
  duracao?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true });
  const reduzir = useReducedMotion();
  const anterior = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduzir || !visto) {
      el.textContent = formatar(valor, formato, moeda);
      if (reduzir) anterior.current = valor;
      return;
    }
    const controle = animate(anterior.current, valor, {
      duration: duracao,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatar(v, formato, moeda);
      },
    });
    anterior.current = valor;
    return () => controle.stop();
  }, [valor, formato, moeda, visto, reduzir, duracao]);

  return (
    <span ref={ref} className={className} aria-label={formatar(valor, formato, moeda)}>
      {formatar(valor, formato, moeda)}
    </span>
  );
}
