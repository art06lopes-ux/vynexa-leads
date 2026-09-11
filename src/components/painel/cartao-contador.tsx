import type { LucideIcon } from "lucide-react";

import { NumeroAnimado } from "@/components/motion/numero-animado";
import { cn } from "@/lib/utils";

/**
 * Formato compacto a partir de mil.
 *
 * "12,4 mil" cabe no cartão; "12.438" quebra a linha no celular e o
 * número deixa de ser lido de relance, que é a única função dele aqui.
 */
function compactar(valor: number): string {
  if (valor < 1000) return String(valor);
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    valor,
  );
}

/**
 * Número principal do painel. Existe um só por tela, por definição.
 *
 * Sem `tabular-nums` de propósito: em corpo grande, dar a todo dígito a
 * largura do zero deixa "121" visivelmente frouxo. Fonte tabular é para
 * coluna de tabela, onde os dígitos precisam alinhar na vertical.
 */
export function NumeroPrincipal({
  rotulo,
  valor,
  valorTexto,
  detalhe,
}: {
  rotulo: string;
  valor?: number;
  /** Valor já formatado — dinheiro, por exemplo. Tem prioridade sobre `valor`. */
  valorTexto?: string;
  detalhe?: string;
}) {
  return (
    <div className="vidro brasa flex flex-col justify-between rounded-xl p-5">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        {valorTexto ?? (
          <NumeroAnimado
            valor={valor ?? 0}
            formatar={(v) => Math.round(v).toLocaleString("pt-BR")}
          />
        )}
      </p>
      {detalhe && <p className="mt-2 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

export function CartaoContador({
  rotulo,
  valor,
  valorTexto,
  total,
  Icone,
  tom = "neutro",
  detalhe,
}: {
  rotulo: string;
  valor: number;
  /** Valor já formatado — dinheiro, por exemplo. Tem prioridade sobre `valor`. */
  valorTexto?: string;
  /** Base para a proporção. Omitido, o cartão não mostra porcentagem. */
  total?: number;
  Icone: LucideIcon;
  tom?: "neutro" | "bom" | "atencao" | "info";
  detalhe?: string;
}) {
  const TONS = {
    neutro: "text-slate-300",
    bom: "text-emerald-300",
    atencao: "text-amber-300",
    info: "text-sky-300",
  } as const;

  const proporcao =
    valorTexto === undefined && total !== undefined && total > 0
      ? Math.round((valor / total) * 100)
      : null;

  return (
    <div className="vidro brasa flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-center gap-2">
        {/* Ícone acompanhando o rótulo em texto: a cor reforça o
            significado, nunca o carrega sozinha. */}
        <Icone className={cn("size-4 shrink-0", TONS[tom])} aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>

      <p className="text-2xl font-semibold tracking-tight">
        {valorTexto ?? <NumeroAnimado valor={valor} formatar={(v) => compactar(Math.round(v))} />}
      </p>

      <p className="text-xs text-muted-foreground">
        {detalhe ?? (proporcao !== null ? `${proporcao}% da carteira` : " ")}
      </p>
    </div>
  );
}
