"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

import { formatar, type FormatoNumero } from "@/components/motion/contador";
import { cn } from "@/lib/utils";

/**
 * Gráficos em SVG puro, sem biblioteca: barras agrupadas, área, rosca e
 * funil. Regras (skill de dataviz): barras finas (≤ 24 px) com ponta
 * arredondada de 4 px e base reta; linha de 2 px; área a 10%; grade de
 * 1 px recessiva; legenda sempre que há duas séries ou mais; texto nunca
 * na cor da série; tooltip em todo gráfico; tabela acessível por trás.
 */

function useLargura<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura];
}

function tetoBonito(max: number): number {
  if (max <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * ordem >= max) return m * ordem;
  return 10 * ordem;
}

function compacto(v: number, formato: FormatoNumero, moeda?: string): string {
  if (formato === "moeda") {
    const reais = v / 100;
    if (reais >= 1000) return `${moeda === "BRL" || !moeda ? "R$ " : ""}${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    return formatar(v, "moeda", moeda);
  }
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return formatar(v, formato, moeda);
}

export type Serie = { chave: string; rotulo: string; cor: string };

export function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.chave} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.cor }} aria-hidden="true" />
          {s.rotulo}
        </li>
      ))}
    </ul>
  );
}

function Dica({ x, y, titulo, linhas, largura }: { x: number; y: number; titulo: string; linhas: Array<{ cor?: string; rotulo: string; valor: string }>; largura: number }) {
  const esquerda = Math.min(Math.max(x - 80, 0), Math.max(0, largura - 168));
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none absolute z-10 w-[10.5rem] rounded-lg border border-fio bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{ left: esquerda, top: Math.max(0, y - 8), transform: "translateY(-100%)" }}
    >
      <p className="mb-1 font-semibold text-foreground">{titulo}</p>
      {linhas.map((l) => (
        <p key={l.rotulo} className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {l.cor && <span className="size-2 rounded-[2px]" style={{ background: l.cor }} />}
            {l.rotulo}
          </span>
          <span className="font-semibold text-foreground num">{l.valor}</span>
        </p>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------
// Barras agrupadas
// ---------------------------------------------------------------------

export function GraficoBarras({
  dados,
  series,
  formato = "inteiro",
  moeda,
  altura = 200,
  destacarUltimo = true,
  className,
  titulo,
}: {
  dados: Array<{ rotulo: string; valores: Record<string, number> }>;
  series: Serie[];
  formato?: FormatoNumero;
  moeda?: string;
  altura?: number;
  destacarUltimo?: boolean;
  className?: string;
  titulo: string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const reduzir = useReducedMotion();

  const margemEsq = 44;
  const margemBase = 22;
  const area = altura - margemBase - 8;
  const max = tetoBonito(Math.max(0, ...dados.flatMap((d) => series.map((s) => d.valores[s.chave] ?? 0))));
  const banda = dados.length > 0 ? (largura - margemEsq) / dados.length : 0;
  const larguraBarra = Math.min(24, Math.max(4, (banda * 0.6 - (series.length - 1) * 2) / series.length));
  const grupo = larguraBarra * series.length + (series.length - 1) * 2;
  const vazio = dados.every((d) => series.every((s) => !(d.valores[s.chave] ?? 0)));

  return (
    <figure className={cn("space-y-3", className)}>
      <Legenda series={series} />
      <div ref={ref} className="relative" style={{ height: altura }} onMouseLeave={() => setFoco(null)}>
        {largura > 0 && (
          <svg width={largura} height={altura} role="img" aria-label={titulo}>
            {[0, 0.5, 1].map((f) => {
              const y = 8 + area * (1 - f);
              return (
                <g key={f}>
                  <line x1={margemEsq} x2={largura} y1={y} y2={y} stroke="rgba(122,150,255,0.1)" />
                  {/* Sem dados, a escala seria de centavos ("R$ 0,01") e não diria nada. */}
                  {!vazio && (
                    <text x={margemEsq - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] num">
                      {compacto(max * f, formato, moeda)}
                    </text>
                  )}
                </g>
              );
            })}
            {dados.map((d, i) => {
              const x0 = margemEsq + i * banda + (banda - grupo) / 2;
              const ultimo = destacarUltimo && i === dados.length - 1;
              return (
                <g key={d.rotulo} onMouseEnter={() => setFoco(i)}>
                  <rect x={margemEsq + i * banda} y={0} width={banda} height={altura} fill={foco === i ? "rgba(122,150,255,0.05)" : "transparent"} />
                  {series.map((s, j) => {
                    const v = d.valores[s.chave] ?? 0;
                    const h = (v / max) * area;
                    const x = x0 + j * (larguraBarra + 2);
                    const y = 8 + area - h;
                    const r = Math.min(4, h, larguraBarra / 2);
                    const caminho = h <= 0 ? "" : `M${x},${8 + area} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + larguraBarra - r},${y} Q${x + larguraBarra},${y} ${x + larguraBarra},${y + r} L${x + larguraBarra},${8 + area} Z`;
                    return (
                      <motion.path
                        key={s.chave}
                        d={caminho}
                        fill={s.cor}
                        style={{ transformOrigin: `${x}px ${8 + area}px`, filter: ultimo && j === 0 ? "drop-shadow(0 0 8px rgba(77,124,255,0.65))" : undefined }}
                        initial={reduzir ? false : { scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                        opacity={foco === null || foco === i ? 1 : 0.55}
                      />
                    );
                  })}
                  <text x={margemEsq + i * banda + banda / 2} y={altura - 6} textAnchor="middle" className={cn("text-[10px]", ultimo ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                    {d.rotulo}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {vazio && largura > 0 && <p className="absolute inset-x-0 top-1/3 text-center text-xs text-muted-foreground">Sem dados no período</p>}
        <AnimatePresence>
          {foco !== null && dados[foco] && (
            <Dica
              x={margemEsq + foco * banda + banda / 2}
              y={8 + area - (Math.max(...series.map((s) => dados[foco].valores[s.chave] ?? 0)) / max) * area}
              titulo={dados[foco].rotulo}
              largura={largura}
              linhas={series.map((s) => ({ cor: s.cor, rotulo: s.rotulo, valor: formatar(dados[foco].valores[s.chave] ?? 0, formato, moeda) }))}
            />
          )}
        </AnimatePresence>
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => (
              <th key={s.chave}>{s.rotulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.map((d) => (
            <tr key={d.rotulo}>
              <td>{d.rotulo}</td>
              {series.map((s) => (
                <td key={s.chave}>{formatar(d.valores[s.chave] ?? 0, formato, moeda)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ---------------------------------------------------------------------
// Área (uma série) com mira
// ---------------------------------------------------------------------

export function GraficoArea({
  pontos,
  formato = "inteiro",
  moeda,
  altura = 120,
  cor = "#4d7cff",
  eixo = false,
  className,
  titulo,
}: {
  pontos: Array<{ rotulo: string; valor: number }>;
  formato?: FormatoNumero;
  moeda?: string;
  altura?: number;
  cor?: string;
  eixo?: boolean;
  className?: string;
  titulo: string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const reduzir = useReducedMotion();
  const id = `ga-${useId().replace(/:/g, "")}`;

  const topo = 10;
  const base = eixo ? 20 : 4;
  const h = altura - topo - base;
  const max = tetoBonito(Math.max(1, ...pontos.map((p) => p.valor)));
  const passo = pontos.length > 1 ? largura / (pontos.length - 1) : largura;
  const xy = pontos.map((p, i) => [i * passo, topo + h - (p.valor / max) * h] as const);
  const linha = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = xy.length ? `${linha} L${largura},${topo + h} L0,${topo + h} Z` : "";

  return (
    <figure className={className}>
      <div
        ref={ref}
        className="relative"
        style={{ height: altura }}
        onMouseMove={(e) => {
          if (!largura || pontos.length === 0) return;
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
          setFoco(Math.max(0, Math.min(pontos.length - 1, Math.round(x / passo))));
        }}
        onMouseLeave={() => setFoco(null)}
      >
        {largura > 0 && (
          <svg width={largura} height={altura} role="img" aria-label={titulo} className="overflow-visible">
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={cor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path d={areaPath} fill={`url(#${id})`} initial={reduzir ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
            <motion.path
              d={linha}
              fill="none"
              stroke={cor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduzir ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: `drop-shadow(0 0 6px ${cor}aa)` }}
            />
            {xy.length > 0 && <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r={4} fill={cor} stroke="#0a1330" strokeWidth={2} />}
            {foco !== null && xy[foco] && (
              <g>
                <line x1={xy[foco][0]} x2={xy[foco][0]} y1={topo} y2={topo + h} stroke="rgba(234,240,255,0.25)" />
                <circle cx={xy[foco][0]} cy={xy[foco][1]} r={4.5} fill={cor} stroke="#0a1330" strokeWidth={2} />
              </g>
            )}
            {eixo &&
              pontos.map((p, i) =>
                i % Math.ceil(pontos.length / 6) === 0 || i === pontos.length - 1 ? (
                  <text key={p.rotulo} x={Math.min(Math.max(i * passo, 12), largura - 12)} y={altura - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {p.rotulo}
                  </text>
                ) : null,
              )}
          </svg>
        )}
        <AnimatePresence>
          {foco !== null && pontos[foco] && xy[foco] && (
            <Dica x={xy[foco][0]} y={xy[foco][1]} largura={largura} titulo={pontos[foco].rotulo} linhas={[{ rotulo: titulo, valor: formatar(pontos[foco].valor, formato, moeda) }]} />
          )}
        </AnimatePresence>
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.rotulo}>
              <td>{p.rotulo}</td>
              <td>{formatar(p.valor, formato, moeda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ---------------------------------------------------------------------
// Rosca
// ---------------------------------------------------------------------

export function Rosca({ fatias, tamanho = 76, espessura = 9, titulo }: { fatias: Array<{ rotulo: string; valor: number; cor: string }>; tamanho?: number; espessura?: number; titulo: string }) {
  const reduzir = useReducedMotion();
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <svg width={tamanho} height={tamanho} className="-rotate-90 shrink-0" role="img" aria-label={`${titulo}: ${fatias.map((f) => `${f.rotulo} ${f.valor}`).join(", ")}`}>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(122,150,255,0.12)" strokeWidth={espessura} />
      {total > 0 &&
        fatias.map((f) => {
          // 2 px de vão entre fatias (no comprimento do arco).
          const comprimento = Math.max(0, (f.valor / total) * circ - (fatias.filter((x) => x.valor > 0).length > 1 ? 2 : 0));
          const inicio = acumulado;
          acumulado += (f.valor / total) * circ;
          return (
            <motion.circle
              key={f.rotulo}
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={r}
              fill="none"
              stroke={f.cor}
              strokeWidth={espessura}
              strokeLinecap="butt"
              strokeDasharray={`${comprimento} ${circ}`}
              initial={reduzir ? false : { strokeDashoffset: -inicio + comprimento }}
              animate={{ strokeDashoffset: -inicio }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
    </svg>
  );
}

// ---------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------

export function Funil({ etapas, titulo }: { etapas: Array<{ rotulo: string; valor: number }>; titulo: string }) {
  const reduzir = useReducedMotion();
  const max = Math.max(1, ...etapas.map((e) => e.valor));
  return (
    <ol className="space-y-2.5" aria-label={titulo}>
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const taxa = anterior ? Math.round((e.valor / anterior) * 100) : null;
        return (
          <li key={e.rotulo} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{e.rotulo}</span>
            <span className="relative h-6 overflow-hidden rounded-md bg-white/[0.04]">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ background: `linear-gradient(90deg, #2453e6, ${i === etapas.length - 1 ? "#2bd47d" : "#6fd3ff"})`, opacity: 1 - i * 0.07 }}
                initial={reduzir ? false : { width: 0 }}
                animate={{ width: `${Math.max(e.valor > 0 ? 2 : 0, (e.valor / max) * 100)}%` }}
                transition={{ duration: 0.8, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white num">{e.valor.toLocaleString("pt-BR")}</span>
            </span>
            <span className="text-right text-xs text-muted-foreground num">{taxa === null ? "" : `${taxa}%`}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra horizontal simples (categoria, país). */
export function BarrasHorizontais({ itens, cor = "#3987e5", formato = "inteiro" }: { itens: Array<{ rotulo: string; valor: number; extra?: string }>; cor?: string; formato?: FormatoNumero }) {
  const reduzir = useReducedMotion();
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">Sem dados ainda.</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((it, i) => (
        <li key={it.rotulo} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-foreground/90">{it.rotulo}</span>
            <span className="shrink-0 text-muted-foreground num">
              {formatar(it.valor, formato)}
              {it.extra && <span className="ml-1.5 text-muted-foreground/70">{it.extra}</span>}
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: cor }}
              initial={reduzir ? false : { width: 0 }}
              animate={{ width: `${(it.valor / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
