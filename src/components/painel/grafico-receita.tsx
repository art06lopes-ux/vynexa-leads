"use client";

import { useId, useState } from "react";

import type { PontoReceita } from "@/lib/vendas/periodos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

/**
 * Receita por dia.
 *
 * Mesma construção do gráfico de leads: SVG à mão, uma série, sem
 * legenda — o título já diz o que a linha é. A diferença é o eixo em
 * dinheiro e o preenchimento em degrau quando o período é longo.
 */

const LARGURA = 720;
const ALTURA = 200;
const MARGEM = { topo: 14, direita: 8, baixo: 24, esquerda: 8 };

function formatarDia(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function GraficoReceita({ serie }: { serie: PontoReceita[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const idGradiente = useId();

  if (serie.length === 0) return null;

  const maximo = Math.max(...serie.map((p) => p.centavos), 1);
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;

  const x = (i: number) =>
    MARGEM.esquerda + (serie.length === 1 ? larguraUtil / 2 : (i / (serie.length - 1)) * larguraUtil);
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / maximo) * alturaUtil;

  const linha = serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.centavos)}`).join(" ");
  const area = `${linha} L${x(serie.length - 1)},${MARGEM.topo + alturaUtil} L${x(0)},${MARGEM.topo + alturaUtil} Z`;

  const total = serie.reduce((s, p) => s + p.centavos, 0);
  const ponto = ativo === null ? null : serie[ativo];

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Receita confirmada por dia</span>
        <span className="num text-xs text-muted-foreground">
          {ponto ? (
            <>
              <span className="text-foreground">{formatarDia(ponto.dia)}</span> ·{" "}
              <span className="font-semibold text-foreground">
                {formatarDinheiro(ponto.centavos)}
              </span>
            </>
          ) : (
            <>{formatarDinheiro(total)} no período</>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-48 w-full"
        role="img"
        aria-label={`Receita confirmada por dia. Total de ${formatarDinheiro(total)} no período.`}
        onMouseLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={MARGEM.esquerda}
          y1={MARGEM.topo + alturaUtil}
          x2={LARGURA - MARGEM.direita}
          y2={MARGEM.topo + alturaUtil}
          stroke="currentColor"
          strokeOpacity="0.12"
        />

        <path d={area} fill={`url(#${idGradiente})`} />
        <path d={linha} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />

        {ativo !== null && serie[ativo] && (
          <>
            <line
              x1={x(ativo)}
              y1={MARGEM.topo}
              x2={x(ativo)}
              y2={MARGEM.topo + alturaUtil}
              stroke="currentColor"
              strokeOpacity="0.25"
            />
            <circle
              cx={x(ativo)}
              cy={y(serie[ativo].centavos)}
              r="5"
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth="2"
            />
          </>
        )}

        {serie.map((p, i) => (
          <rect
            key={p.dia}
            x={x(i) - larguraUtil / serie.length / 2}
            y={MARGEM.topo}
            width={larguraUtil / serie.length}
            height={alturaUtil}
            fill="transparent"
            onMouseEnter={() => setAtivo(i)}
          />
        ))}

        <text x={x(0)} y={ALTURA - 6} fill="currentColor" fillOpacity="0.45" fontSize="11">
          {formatarDia(serie[0]!.dia)}
        </text>
        <text
          x={x(serie.length - 1)}
          y={ALTURA - 6}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.45"
          fontSize="11"
        >
          {formatarDia(serie[serie.length - 1]!.dia)}
        </text>
      </svg>
    </figure>
  );
}
