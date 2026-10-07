import type { Metadata } from "next";

import { Marca } from "@/components/marca";
import { FormularioLogin } from "@/app/login/formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { destino } = await searchParams;

  // Só repassa destino interno. A validação definitiva está na Server
  // Action; esta aqui evita até montar o campo com lixo.
  const destinoSeguro =
    typeof destino === "string" && destino.startsWith("/") && !destino.startsWith("//")
      ? destino
      : undefined;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-20%] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-azul/25 blur-[140px]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Marca mostrarTexto={false} className="scale-150" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vynexa Leads</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Prospecção e vendas da Vynexa Dev. Acesso restrito.
            </p>
          </div>
        </div>

        <FormularioLogin destino={destinoSeguro} />
      </div>
    </main>
  );
}
