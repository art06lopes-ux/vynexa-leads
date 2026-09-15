import type { LucideIcon } from "lucide-react";

import { NumeroAnimado, type FormatoNumero } from "@/components/motion/numero-animado";
import { cn } from "@/lib/utils";

/**
 * Cartão de métrica.
 *
 * Todos com a mesma anatomia — rótulo-olho em cima, número grande no
 * meio, detalhe embaixo — e a mesma altura na grade. É a uniformidade
 * que faz uma linha de cartões parecer um painel e não um mural.
 *
 * Sem `tabular-nums` no número grande: em corpo grande, dar a todo dígito
 * a largura do zero deixa "121" frouxo. Tabular é para coluna de tabela.
 */

const TONS = {
  neutro: "text-slate-300",
  bom: "text-emerald-300",
  atencao: "text-amber-300",
  info: "text-sky-300",
  neon: "text-neon",
} as const;

export function CartaoContador({
  rotulo,
  valor,
  valorTexto,
  formato = "compacto",
  total,
  Icone,
  tom = "neutro",
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  /** Valor já formatado. Tem prioridade sobre `valor` + `formato`. */
  valorTexto?: string;
  formato?: FormatoNumero;
  /** Base para a porcentagem. Omitido, não mostra proporção. */
  total?: number;
  Icone?: LucideIcon;
  tom?: keyof typeof TONS;
  detalhe?: string;
  /** Cartão maior, para o número principal de uma seção. */
  destaque?: boolean;
}) {
  const proporcao =
    valorTexto === undefined && total !== undefined && total > 0
      ? Math.round((valor / total) * 100)
      : null;

  return (
    <div
      className={cn(
        "vidro brasa flex h-full flex-col justify-between gap-3 rounded-xl",
        destaque ? "moldura p-6" : "p-4",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="olho-mudo">{rotulo}</p>
        {Icone && (
          // Ícone acompanhando o rótulo em texto: a cor reforça o
          // significado, nunca o carrega sozinha.
          <Icone className={cn("size-4 shrink-0", TONS[tom])} aria-hidden="true" />
        )}
      </div>

      <p
        className={cn(
          "font-semibold tracking-tight",
          destaque ? "texto-neon text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
        )}
      >
        {valorTexto ?? <NumeroAnimado valor={valor} formato={formato} />}
      </p>

      <p className="num min-h-4 text-xs text-muted-foreground">
        {detalhe ?? (proporcao !== null ? `${proporcao}% da carteira` : " ")}
      </p>
    </div>
  );
}

/** O número principal de uma seção é um cartão em destaque. */
export function NumeroPrincipal({
  rotulo,
  valor,
  valorTexto,
  detalhe,
}: {
  rotulo: string;
  valor?: number;
  valorTexto?: string;
  detalhe?: string;
}) {
  return (
    <CartaoContador
      rotulo={rotulo}
      valor={valor ?? 0}
      valorTexto={valorTexto}
      formato="inteiro"
      detalhe={detalhe}
      destaque
    />
  );
}
