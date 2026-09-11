import { LogOut } from "lucide-react";

import { Marca } from "@/components/marca";
import { Dock } from "@/components/painel/dock";
import { BuscaGlobal } from "@/components/painel/busca-global";
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
        <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <Marca className="shrink-0" mostrarTexto={false} />

          <BuscaGlobal />

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

      {/* `pb-28` reserva a altura do dock flutuante. Sem essa folga a
          última linha da tabela fica escondida atrás dele. */}
      <main className="w-full min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <Dock />
    </div>
  );
}
