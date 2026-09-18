"use client";

import { DatabaseZap, RotateCw } from "lucide-react";

/**
 * Rede de segurança do painel inteiro.
 *
 * A maioria das telas lê o Turso direto no Server Component, sem
 * try/catch — de propósito, para não esconder o erro real em cada
 * página. Este arquivo é o único lugar que precisa saber lidar com
 * "o banco caiu", e cobre qualquer rota dentro do layout raiz.
 */
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <DatabaseZap className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold">Não deu para carregar agora</h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          O banco de dados está indisponível no momento — provavelmente a cota mensal
          gratuita do Turso foi atingida. Ela reseta sozinha; tente de novo em instantes.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-1 inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Tentar de novo
      </button>
    </main>
  );
}
