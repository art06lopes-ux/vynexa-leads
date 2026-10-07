import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Peças de página: cabeçalho, cartão com título e ação, estado vazio.
 * Componentes de servidor (sem "use client"): podem receber ícone como
 * componente porque não cruzam a fronteira para o cliente.
 */

export function Cabecalho({
  icone: Icone,
  titulo,
  descricao,
  trilha,
  acoes,
}: {
  icone?: LucideIcon;
  titulo: string;
  descricao?: React.ReactNode;
  trilha?: Array<{ href: string; rotulo: string }>;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icone && (
          <span className="pastilha mt-0.5 size-11 shrink-0">
            <Icone className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {trilha && trilha.length > 0 && (
            <nav className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Trilha">
              {trilha.map((t, i) => (
                <span key={t.href} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  <Link href={t.href} className="hover:text-foreground">
                    {t.rotulo}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{titulo}</h1>
          {descricao && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({
  icone: Icone,
  titulo,
  subtitulo,
  href,
  acao,
  className,
  corpoClassName,
  children,
}: {
  icone?: LucideIcon;
  titulo?: string;
  subtitulo?: string;
  href?: string;
  acao?: React.ReactNode;
  className?: string;
  corpoClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("placa flex flex-col", className)}>
      {(titulo || Icone) && (
        <header className="flex items-center gap-3 px-5 pt-4">
          {Icone && (
            <span className="pastilha size-8 shrink-0">
              <Icone className="size-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {titulo && <h2 className="truncate font-display text-[0.95rem] font-semibold">{titulo}</h2>}
            {subtitulo && <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>}
          </div>
          {acao}
          {href && (
            <Link
              href={href}
              aria-label={`Abrir ${titulo ?? ""}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brilho/40 bg-azul/15 text-ciano transition-colors hover:bg-azul/30"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          )}
        </header>
      )}
      <div className={cn("flex-1 px-5 pb-5 pt-4", corpoClassName)}>{children}</div>
    </section>
  );
}

export function Vazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="relative mb-4 flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-azul/10 [animation-duration:2.6s]" aria-hidden="true" />
        <span className="pastilha-muda relative size-14 rounded-2xl">
          <Icone className="size-6" aria-hidden="true" />
        </span>
      </span>
      <p className="font-display text-base font-semibold">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

/** Aviso de integração que falta configurar — honesto sobre o que não funciona ainda. */
export function AvisoConfiguracao({ titulo, children, href = "/configuracoes?aba=integracoes" }: { titulo: string; children: React.ReactNode; href?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-aviso/30 bg-aviso/[0.07] p-4 text-sm sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-semibold text-aviso">{titulo}</p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
      <Link href={href} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-aviso/40 px-3 text-xs font-semibold text-aviso hover:bg-aviso/10">
        Configurar
      </Link>
    </div>
  );
}
