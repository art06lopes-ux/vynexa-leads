"use client";

import { useEffect, useId, useRef, useState } from "react";

import { gsap, SEM_REDUCAO } from "@/components/motion/gsap";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

export type PontoGrafico = { dia: string; valor: number };

type Formato = "inteiro" | "dinheiro";

/**
 * Gráfico de linha do painel — a peça que a referência faz bem e a
 * primeira versão fazia mal.
 *
 * O que entrou, e por quê:
 * - Grade horizontal e eixo Y com quatro marcas: sem eles um pico não
 *   tem escala, e "subiu" não diz quanto.
 * - Eixo X com cinco datas, não só as pontas.
 * - Linha de comparação (período anterior) tracejada e apagada, para o
 *   "hoje vs. antes" da referência. Duas séries pedem legenda; uma não.
 * - Crosshair no hover mostrando as duas séries do mesmo dia.
 * - A linha principal se traça na entrada (Draw SVG).
 *
 * SVG à mão. Uma biblioteca de gráfico pesaria mais que a página.
 */

const LARGURA = 760;
const ALTURA = 240;
const M = { topo: 16, direita: 12, baixo: 28, esquerda: 56 };
const MARCAS_Y = 4;

function formatar(v: number, formato: Formato): string {
  return formato === "dinheiro" ? formatarDinheiro(Math.round(v)) : Math.round(v).toLocaleString("pt-BR");
}

/** Eixo Y curto: "R$ 1,3 mil" em vez de "R$ 1.297,00" para não invadir o gráfico. */
function formatarEixo(v: number, formato: Formato): string {
  if (formato === "dinheiro") {
    const reais = v / 100;
    if (reais >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    return `R$ ${Math.round(reais)}`;
  }
  return v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v));
}

function formatarDia(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/**
 * Teto "redondo" acima do máximo, para a grade cair em valores legíveis.
 *
 * Com tudo zerado, o teto mínimo é 4 unidades (ou R$ 100) — senão a
 * grade vira "0, 1, 1, 1, 1" por arredondamento e o eixo parece bug.
 */
function tetoBonito(max: number, formato: Formato): number {
  if (max <= 0) return formato === "dinheiro" ? 10000 : 4;
  const ordem = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / ordem;
  const passo = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return passo * ordem;
}

export function GraficoLinha({
  titulo,
  olho,
  serie,
  comparacao,
  rotuloSerie = "Período atual",
  rotuloComparacao = "Período anterior",
  formato = "inteiro",
}: {
  titulo: string;
  olho: string;
  serie: PontoGrafico[];
  comparacao?: PontoGrafico[];
  rotuloSerie?: string;
  rotuloComparacao?: string;
  formato?: Formato;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const id = useId();
  const refLinha = useRef<SVGPathElement>(null);
  const refArea = useRef<SVGPathElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(SEM_REDUCAO, () => {
      if (!refLinha.current || !refArea.current) return;
      const tl = gsap.timeline();
      tl.fromTo(refLinha.current, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.3, ease: "power2.inOut" });
      tl.fromTo(refArea.current, { opacity: 0 }, { opacity: 1, duration: 0.6 }, "-=0.6");
    });
    return () => mm.revert();
  }, [serie]);

  if (serie.length === 0) return null;

  const temComparacao = Boolean(comparacao && comparacao.length === serie.length);
  const maxDados = Math.max(...serie.map((p) => p.valor), ...(temComparacao ? comparacao!.map((p) => p.valor) : [0]), 0);
  const teto = tetoBonito(maxDados, formato);

  const w = LARGURA - M.esquerda - M.direita;
  const h = ALTURA - M.topo - M.baixo;
  const x = (i: number) => M.esquerda + (serie.length === 1 ? w / 2 : (i / (serie.length - 1)) * w);
  const y = (v: number) => M.topo + h - (v / teto) * h;

  const caminho = (pts: PontoGrafico[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.valor)}`).join(" ");
  const linha = caminho(serie);
  const area = `${linha} L${x(serie.length - 1)},${M.topo + h} L${x(0)},${M.topo + h} Z`;
  const linhaComp = temComparacao ? caminho(comparacao!) : null;

  const total = serie.reduce((s, p) => s + p.valor, 0);
  const ponto = ativo === null ? null : serie[ativo];
  const pontoComp = ativo === null || !temComparacao ? null : comparacao![ativo];

  // Cinco rótulos no eixo X, espalhados. Catorze datas viram borrão.
  const idxX = Array.from(new Set([0, ...Array.from({ length: 3 }, (_, k) => Math.round(((k + 1) * (serie.length - 1)) / 4)), serie.length - 1]));

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="olho-mudo">{olho}</p>
          <p className="mt-0.5 text-base font-semibold">{titulo}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* Legenda só com duas séries: com uma, o título já nomeia. */}
          {temComparacao && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded bg-acento" aria-hidden="true" />
                {rotuloSerie}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded border-t border-dashed border-muted-foreground" aria-hidden="true" />
                {rotuloComparacao}
              </span>
            </div>
          )}
          <p className="num text-xs text-muted-foreground">
            {ponto ? (
              <>
                <span className="text-foreground">{formatarDia(ponto.dia)}</span>
                {" · "}
                <span className="font-semibold text-acento">{formatar(ponto.valor, formato)}</span>
                {pontoComp && (
                  <>
                    {" · antes "}
                    <span className="text-foreground">{formatar(pontoComp.valor, formato)}</span>
                  </>
                )}
              </>
            ) : (
              <>{formatar(total, formato)} no período</>
            )}
          </p>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-56 w-full"
        role="img"
        aria-label={`${titulo}. Total de ${formatar(total, formato)} no período.`}
        onMouseLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--acento)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--acento)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grade e eixo Y. Recessivos: a grade existe para ler, não para ver. */}
        {Array.from({ length: MARCAS_Y + 1 }, (_, k) => {
          const v = (teto / MARCAS_Y) * k;
          const yy = y(v);
          return (
            <g key={k}>
              <line x1={M.esquerda} y1={yy} x2={LARGURA - M.direita} y2={yy} stroke="currentColor" strokeOpacity={k === 0 ? 0.18 : 0.07} />
              <text x={M.esquerda - 8} y={yy + 3.5} textAnchor="end" fill="currentColor" fillOpacity="0.5" fontSize="10" className="num">
                {formatarEixo(v, formato)}
              </text>
            </g>
          );
        })}

        {linhaComp && (
          <path d={linhaComp} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 4" strokeLinejoin="round" />
        )}

        <path ref={refArea} d={area} fill={`url(#${id}-area)`} />
        <path ref={refLinha} d={linha} fill="none" stroke="var(--acento)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

        {ativo !== null && serie[ativo] && (
          <>
            <line x1={x(ativo)} y1={M.topo} x2={x(ativo)} y2={M.topo + h} stroke="var(--acento)" strokeOpacity="0.35" strokeDasharray="2 3" />
            {pontoComp && <circle cx={x(ativo)} cy={y(pontoComp.valor)} r="3.5" fill="var(--card)" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />}
            <circle cx={x(ativo)} cy={y(serie[ativo].valor)} r="5.5" fill="var(--acento)" stroke="var(--card)" strokeWidth="2" />
          </>
        )}

        {serie.map((p, i) => (
          <rect key={p.dia} x={x(i) - w / serie.length / 2} y={M.topo} width={w / serie.length} height={h} fill="transparent" onMouseEnter={() => setAtivo(i)} />
        ))}

        {idxX.map((i) => (
          <text key={i} x={x(i)} y={ALTURA - 8} textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"} fill="currentColor" fillOpacity="0.5" fontSize="10" className="num">
            {formatarDia(serie[i]!.dia)}
          </text>
        ))}
      </svg>
    </figure>
  );
}
