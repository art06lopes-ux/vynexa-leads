"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * O anel de score — a peça de identidade do produto. O arco cresce até
 * o valor, e a cor segue a faixa: alta (≥70) azul-ciano, média (45–69)
 * âmbar, baixa cinza-azulado. Sempre com o número no centro: a cor não
 * carrega o significado sozinha.
 */

export function corDoScore(score: number | null): string {
  if (score === null) return "#4a5784";
  if (score >= 70) return "#6fd3ff";
  if (score >= 45) return "#f5b83d";
  return "#7b88b3";
}

export function AnelScore({ score, tamanho = 44, espessura = 4, className, rotulo = true }: { score: number | null; tamanho?: number; espessura?: number; className?: string; rotulo?: boolean }) {
  const reduzir = useReducedMotion();
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const fracao = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const cor = corDoScore(score);

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: tamanho, height: tamanho }} role="img" aria-label={score === null ? "Sem score" : `Score ${score} de 100`}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(122,150,255,0.14)" strokeWidth={espessura} />
        <motion.circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: reduzir ? circ * (1 - fracao) : circ }}
          animate={{ strokeDashoffset: circ * (1 - fracao) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: score !== null && score >= 70 ? "drop-shadow(0 0 4px rgba(111,211,255,0.6))" : undefined }}
        />
      </svg>
      {rotulo && (
        <span className="absolute font-display font-semibold num" style={{ fontSize: tamanho * 0.32 }}>
          {score ?? "–"}
        </span>
      )}
    </span>
  );
}

/** Barra de pontos de cada motivo do score, com animação de preenchimento. */
export function BarraMotivo({ pontos, maximo = 30 }: { pontos: number; maximo?: number }) {
  const largura = Math.min(100, (Math.abs(pontos) / maximo) * 100);
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.span
        className={cn("absolute inset-y-0 left-0 rounded-full", pontos >= 0 ? "bg-gradient-to-r from-azul to-ciano" : "bg-perigo/80")}
        initial={{ width: 0 }}
        animate={{ width: `${largura}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </span>
  );
}
