"use client";

import { useId, useState } from "react";

import type { PontoSerie } from "@/db/consultas";

/**
 * Leads adicionados por dia.
 *
 * SVG escrito à mão, sem biblioteca de gráficos. São dois `path` e uma
 * camada de hover — uma dependência de gráfico custaria mais bytes no
 * navegador do que a página inteira pesa hoje.
 *
 * Uma série só, então não há legenda: o título já diz o que a linha é.
 * Colocar uma legenda de um item seria ruído.
 */

const LARGURA = 720;
const ALTURA = 180;
const MARGEM = { topo: 12, direita: 8, baixo: 22, esquerda: 8 };

function formatarDia(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function GraficoLeads({ serie }: { serie: PontoSerie[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const idGradiente = useId();

  if (serie.length === 0) return null;

  const maximo = Math.max(...serie.map((p) => p.total), 1);
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;

  const x = (i: number) =>
    MARGEM.esquerda + (serie.length === 1 ? larguraUtil / 2 : (i / (serie.length - 1)) * larguraUtil);
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / maximo) * alturaUtil;

  const linha = serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.total)}`).join(" ");
  const area = `${linha} L${x(serie.length - 1)},${MARGEM.topo + alturaUtil} L${x(0)},${MARGEM.topo + alturaUtil} Z`;

  const total = serie.reduce((s, p) => s + p.total, 0);
  const ponto = ativo === null ? null : serie[ativo];

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Empresas encontradas por dia</span>
        <span className="num text-xs text-muted-foreground">
          {ponto ? (
            <>
              <span className="text-foreground">{formatarDia(ponto.dia)}</span> ·{" "}
              <span className="font-semibold text-foreground">{ponto.total}</span>
            </>
          ) : (
            <>últimos {serie.length} dias · {total} no total</>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-44 w-full"
        role="img"
        aria-label={`Empresas encontradas por dia nos últimos ${serie.length} dias. Total de ${total}.`}
        onMouseLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Linha de base recessiva. O eixo não compete com o dado. */}
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
            {/* Anel na cor da superfície separa o ponto da linha. */}
            <circle cx={x(ativo)} cy={y(serie[ativo].total)} r="5" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
          </>
        )}

        {/* Alvos de hover invisíveis, largos o bastante para o mouse
            acertar sem precisar mirar no ponto exato da linha. */}
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

        {/* Só as pontas recebem rótulo: catorze datas viram borrão. */}
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
