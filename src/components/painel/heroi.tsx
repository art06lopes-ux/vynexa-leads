"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { NumeroAnimado, type FormatoNumero } from "@/components/motion/numero-animado";
import { TextoEmbaralhado } from "@/components/motion/texto-embaralhado";
import { cn } from "@/lib/utils";

export type MetricaHeroi = {
  olho: string;
  valor: number;
  formato: FormatoNumero;
  detalhe?: string;
};

/**
 * Painel-herói, na composição da referência: rótulo-olho centrado,
 * título, data, o número dentro de um quadro, a variação
 * contra ontem, e três métricas alinhadas no rodapé.
 *
 * Centrado de propósito, ao contrário do resto da página: é o único
 * bloco que se quer ver de longe, e centro é o que o olho encontra
 * primeiro. Existe um por tela — dois heróis é nenhum.
 */
export function Heroi({
  olho,
  titulo,
  subtitulo,
  centavos,
  variacao,
  rotuloVariacao = "vs. ontem",
  metricas,
  className,
}: {
  olho: string;
  titulo: string;
  subtitulo?: string;
  centavos: number;
  variacao?: number | null;
  rotuloVariacao?: string;
  metricas?: MetricaHeroi[];
  className?: string;
}) {
  const subiu = (variacao ?? 0) >= 0;

  return (
    <section
      aria-label={titulo}
      className={cn("heroi rounded-2xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-9", className)}
    >
      <div className="relative flex flex-col items-center text-center">
        <p className="olho flex flex-wrap items-center justify-center gap-3">
          <TextoEmbaralhado texto={olho} />
          <span className="ao-vivo inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 tracking-[0.15em] text-foreground/80">
            AO VIVO
          </span>
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{titulo}</h2>
        {subtitulo && <p className="num mt-1 text-xs text-muted-foreground">{subtitulo}</p>}

        {/* O quadro do número principal. */}
        <div className="mt-6 w-full max-w-xl rounded-lg border border-border bg-black/25 px-6 py-6 sm:px-10 sm:py-8">
          <p className="olho-mudo mb-2">Faturamento confirmado</p>
          <p className="flex flex-wrap items-end justify-center gap-x-4 gap-y-2">
            <NumeroAnimado
              valor={centavos}
              formato="dinheiro"
              duracao={1.4}
              className="text-acento text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            />
          </p>

          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="ao-vivo" aria-hidden="true" />
              Atualização automática
            </span>
            {variacao !== null && variacao !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  subiu ? "text-emerald-300" : "text-destructive",
                )}
              >
                {subiu ? (
                  <TrendingUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3.5" aria-hidden="true" />
                )}
                {subiu ? "+" : ""}
                {variacao}% {rotuloVariacao}
              </span>
            )}
          </p>
        </div>
      </div>

      {metricas && metricas.length > 0 && (
        <dl className="relative mt-6 grid grid-cols-1 divide-y divide-border border-t border-border pt-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {metricas.map((m) => (
            <div key={m.olho} className="flex flex-col items-center gap-1 px-4 py-4 text-center">
              <dt className="olho-mudo">{m.olho}</dt>
              <dd className="text-xl font-semibold tracking-tight sm:text-2xl">
                <NumeroAnimado valor={m.valor} formato={m.formato} duracao={1.2} />
              </dd>
              {m.detalhe && <dd className="text-xs text-muted-foreground">{m.detalhe}</dd>}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
