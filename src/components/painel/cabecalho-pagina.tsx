import type { ReactNode } from "react";

/**
 * Cabeçalho de página: rótulo-olho, título grande, ações à direita, fio
 * fino embaixo. É a mesma peça em todas as telas — a consistência é o
 * que faz o site parecer um produto e não um conjunto de páginas.
 */
export function CabecalhoPagina({
  olho,
  titulo,
  descricao,
  acoes,
}: {
  olho: string;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="olho">
            {olho}
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
          {descricao && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{descricao}</p>}
        </div>

        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>

      <div className="fio" aria-hidden="true" />
    </header>
  );
}

/** Título de seção dentro da página. */
export function TituloSecao({ olho, titulo, extra }: { olho: string; titulo?: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="olho-mudo">{olho}</p>
        {titulo && <h2 className="mt-0.5 text-base font-semibold">{titulo}</h2>}
      </div>
      {extra}
    </div>
  );
}
