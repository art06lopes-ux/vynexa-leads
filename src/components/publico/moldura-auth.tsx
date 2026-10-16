import Link from "next/link";

import { Marca } from "@/components/marca";
import { EsculturaV } from "@/components/marca/escultura-v";

/**
 * Moldura das telas de conta (cadastro, senha): à esquerda o bloco em
 * brasa com a promessa do produto; à direita o formulário. No celular a
 * marca vira uma faixa curta em cima.
 */
export function MolduraAuth({ titulo, subtitulo, frase, children }: { titulo: string; subtitulo?: React.ReactNode; frase: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="heroi relative m-3 flex min-h-48 flex-col justify-between overflow-hidden rounded-3xl p-7 sm:p-10 lg:m-4 lg:min-h-0">
        <EsculturaV className="absolute -right-20 -top-10 -z-10 h-[64%] opacity-95 lg:-right-14 lg:-top-6 lg:h-[62%]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-[#3a0d02]/85 via-[#5a1604]/45 to-transparent" />
        <Link href="/conheca" aria-label="Vynexa Leads — página inicial">
          <Marca className="[&_span]:text-white" />
        </Link>
        <p className="max-w-md text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-[3rem]">{frase}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mb-6 mt-1.5 text-sm text-muted-foreground">{subtitulo}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
