"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { NumeroAnimado } from "@/components/motion/numero-animado";
import { TextoEmbaralhado } from "@/components/motion/texto-embaralhado";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";

/**
 * Painel-herói: o número que a tela lidera.
 *
 * É o "Vendas hoje R$ 3.123,00" da referência: moldura neon, brilho vindo
 * do canto, rótulo embaralhando ao entrar, número subindo até o valor.
 * Existe um só por tela, por definição — dois heróis é nenhum.
 *
 * O número usa a fonte proporcional (sem `tabular-nums`): em corpo
 * grande, dar a todo dígito a largura do zero deixa "121" frouxo.
 */
export function Heroi({
  rotuloSuperior,
  rotulo,
  centavos,
  variacao,
  detalhe,
  className,
}: {
  rotuloSuperior: string;
  rotulo: string;
  centavos: number;
  /** Percentual contra o período anterior. Nulo quando não há base. */
  variacao?: number | null;
  detalhe?: string;
  className?: string;
}) {
  const subiu = (variacao ?? 0) >= 0;

  return (
    <section
      aria-label={rotulo}
      className={cn("heroi rounded-2xl px-6 py-7 sm:px-8 sm:py-9", className)}
    >
      <p className="flex flex-wrap items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-neon/90">
        <TextoEmbaralhado texto={rotuloSuperior} />
        <span className="ao-vivo inline-flex items-center gap-1.5 rounded-full border border-neon/30 px-2 py-0.5 text-[0.65rem] tracking-[0.15em] text-foreground/80">
          AO VIVO
        </span>
      </p>

      <h2 className="mt-1 text-lg font-medium text-foreground/90">{rotulo}</h2>

      <p className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <NumeroAnimado
          valor={centavos}
          formatar={(v) => formatarDinheiro(Math.round(v))}
          duracao={1.3}
          className="texto-neon text-5xl font-bold tracking-tight sm:text-6xl"
        />

        {variacao !== null && variacao !== undefined && (
          <span
            className={cn(
              "mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold",
              subiu
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {subiu ? (
              <TrendingUp className="size-4" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-4" aria-hidden="true" />
            )}
            {subiu ? "+" : ""}
            {variacao}% vs. ontem
          </span>
        )}
      </p>

      {detalhe && <p className="mt-3 text-sm text-muted-foreground">{detalhe}</p>}
    </section>
  );
}
