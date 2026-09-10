import { LogOut } from "lucide-react";

import { Marca } from "@/components/marca";
import { Navegacao } from "@/components/painel/navegacao";
import { Button } from "@/components/ui/button";
import { sair } from "@/server/acoes-auth";
import { exigirSessao } from "@/server/sessao";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  // Repete a checagem do proxy de propósito: o `matcher` é uma expressão
  // regular, e uma rota nova pode escapar dela sem ninguém notar.
  await exigirSessao();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="vidro sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Marca className="shrink-0" />

          <div className="mx-auto sm:mx-0">
            <Navegacao />
          </div>

          <form action={sair} className="ml-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-11 cursor-pointer gap-2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
              <span className="sr-only sm:hidden">Sair</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
