import type { Metadata } from "next";

import { Marca } from "@/components/marca";
import { Particulas } from "@/components/motion/particulas";
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
      <Particulas densidade={70} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Marca mostrarTexto={false} className="scale-125" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vynexa Leads</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ferramenta interna de prospecção. Acesso restrito.
            </p>
          </div>
        </div>

        <FormularioLogin destino={destinoSeguro} />
      </div>
    </main>
  );
}
