"use client";

import Link from "next/link";

import { PERIODOS, type ChavePeriodo } from "@/lib/vendas/periodos";
import { cn } from "@/lib/utils";

/**
 * Períodos como links, não botões com estado.
 *
 * O período fica na URL, então o link é compartilhável e o botão voltar
 * do navegador funciona. Também dispensa JavaScript para trocar de faixa.
 */
export function SeletorPeriodo({ atual }: { atual: ChavePeriodo }) {
  return (
    <nav
      aria-label="Período"
      className="flex h-11 items-stretch overflow-hidden rounded-full border border-input"
    >
      {(Object.keys(PERIODOS) as ChavePeriodo[]).map((chave) => {
        const ativo = chave === atual;

        return (
          <Link
            key={chave}
            href={`/vendas?periodo=${chave}`}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex cursor-pointer items-center px-3 text-xs font-medium transition-colors duration-200 sm:px-4 sm:text-sm",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {PERIODOS[chave].rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
