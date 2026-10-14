import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * O V da Vynexa esculpido em linhas de brasa — a imagem-assinatura dos
 * banners. É o mesmo V repetido em camadas que recuam e esmaecem, como
 * um objeto extrudado; a face da frente leva o degradê da marca.
 *
 * Vetor puro (nada de imagem pesada), escala sem perder nitidez e pode
 * "respirar" devagar. Com movimento reduzido, fica parado.
 */

// O V da marca simplificado em polígono (caixa 0–100), vértice embaixo.
const V = [
  [4, 10],
  [30, 10],
  [50, 58],
  [70, 10],
  [96, 10],
  [60, 92],
  [40, 92],
] as const;

function pontos(dx: number, dy: number, s: number): string {
  // escala em torno do centro do V (50, 52)
  return V.map(([x, y]) => `${(50 + (x - 50) * s + dx).toFixed(2)},${(52 + (y - 52) * s + dy).toFixed(2)}`).join(" ");
}

export function EsculturaV({ className, camadas = 26, viva = true }: { className?: string; camadas?: number; viva?: boolean }) {
  const id = useId().replace(/:/g, "");
  const linhas = Array.from({ length: camadas }, (_, i) => i + 1);

  return (
    <svg viewBox="-20 -20 150 150" className={cn("pointer-events-none select-none", className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe2b4" />
          <stop offset="0.35" stopColor="#ffb347" />
          <stop offset="0.7" stopColor="#ff5a1f" />
          <stop offset="1" stopColor="#b8320a" />
        </linearGradient>
        <radialGradient id={`brilho-${id}`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ff7a45" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="55" cy="50" r="62" fill={`url(#brilho-${id})`} />

      {/* Camadas que recuam: da mais funda (apagada) para a mais próxima. */}
      {linhas.reverse().map((k) => (
        <polygon
          key={k}
          points={pontos(k * 1.05, -k * 1.55, 1 - k * 0.006)}
          fill="none"
          stroke="#ffd2b0"
          strokeOpacity={Math.max(0.05, 0.62 - k * 0.022)}
          strokeWidth={0.32}
          strokeLinejoin="round"
          className={viva ? "escultura-linha" : undefined}
          style={viva ? { animationDelay: `${(k * 0.11).toFixed(2)}s` } : undefined}
        />
      ))}

      <polygon points={pontos(0, 0, 1)} fill={`url(#face-${id})`} stroke="#fff1e0" strokeOpacity="0.55" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  );
}
