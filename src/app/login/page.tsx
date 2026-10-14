import type { Metadata } from "next";

import { FormularioLogin } from "@/app/login/formulario-login";
import { Marca } from "@/components/marca";
import { EsculturaV } from "@/components/marca/escultura-v";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Entrada da central da Vynexa: à esquerda, a marca (o V esculpido em
 * brasa e a frase da empresa); à direita, só a senha. No celular, a
 * marca vira uma faixa curta em cima e o formulário vem logo abaixo.
 */
export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { destino } = await searchParams;

  // Só repassa destino interno. A validação definitiva está na Server
  // Action; esta aqui evita até montar o campo com lixo.
  const destinoSeguro =
    typeof destino === "string" && destino.startsWith("/") && !destino.startsWith("//") ? destino : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="heroi relative m-3 flex min-h-56 flex-col justify-between overflow-hidden rounded-3xl p-7 sm:p-10 lg:m-4 lg:min-h-0">
        <EsculturaV className="absolute -right-20 -top-10 -z-10 h-[64%] opacity-95 lg:-right-14 lg:-top-6 lg:h-[62%]" />
        {/* Base escura: o texto branco fica sobre brasa funda, não sobre o V claro. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-[#3a0d02]/85 via-[#5a1604]/45 to-transparent" />
        <Marca className="[&_span]:text-white" />
        <div className="max-w-md">
          <p className="text-[0.72rem] font-semibold text-white/75">Sites · Apps · Soluções com IA</p>
          <h1 className="mt-3 text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[3.4rem]">Transformamos ideias em tecnologia.</h1>
          <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-white/90 sm:block">
            A central da Vynexa: encontre empresas, aborde, feche e entregue — tudo num lugar só.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Entrar na central</h2>
          <p className="mb-6 mt-1.5 text-sm text-muted-foreground">Acesso restrito à Vynexa Dev.</p>
          <FormularioLogin destino={destinoSeguro} />
        </div>
      </section>
    </main>
  );
}
