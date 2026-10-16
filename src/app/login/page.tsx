import type { Metadata } from "next";
import Link from "next/link";

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
        <Link href="/conheca" aria-label="Vynexa Leads">
          <Marca className="[&_span]:text-white" />
        </Link>
        <div className="max-w-md">
          <h1 className="text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[3.4rem]">Encontre quem precisa de um site hoje.</h1>
          <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-white/90 sm:block">
            O Vynexa Leads mapeia as empresas da sua cidade, mostra quem não tem site e organiza a sua abordagem até a venda.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
          <p className="mb-6 mt-1.5 text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-semibold text-ciano underline-offset-2 hover:underline">
              Teste grátis
            </Link>
          </p>
          <FormularioLogin destino={destinoSeguro} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/conheca" className="hover:text-foreground">
              Conhecer o Vynexa Leads
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
