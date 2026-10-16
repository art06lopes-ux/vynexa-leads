import Link from "next/link";

import { Marca } from "@/components/marca";

/** Moldura simples e legível para Termos e Privacidade. */
export function PaginaLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0b0a09]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/conheca" aria-label="Vynexa Leads">
            <Marca />
          </Link>
          <Link href="/cadastro" className="text-sm font-semibold text-ciano hover:underline">
            Criar conta
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em {atualizado}</p>
        <div className="mt-10 space-y-8 text-[0.95rem] leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}
