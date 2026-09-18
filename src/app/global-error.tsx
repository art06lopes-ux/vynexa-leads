"use client";

import { DatabaseZap, RotateCw } from "lucide-react";

/**
 * Última rede de segurança, fora do layout normal.
 *
 * Só entra em cena quando o erro acontece acima do `RootLayout` (ex.: nos
 * fontes ou no próprio layout) — por isso monta `<html>`/`<body>` do zero
 * em vez de reaproveitar o layout, que pode ser a própria causa da queda.
 * O caso comum, um Server Component que lê o banco, cai em `error.tsx`.
 */
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
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
      </body>
    </html>
  );
}
