import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Abas no topo de uma página: visões do mesmo assunto (Leads: para abordar
 * / todos / mapa). São links — cada aba tem endereço próprio e o botão
 * voltar do navegador funciona.
 */
export function AbasPagina({ abas, ativa }: { abas: Array<{ chave: string; rotulo: string; href: string; numero?: number }>; ativa: string }) {
  return (
    <nav className="-mt-1 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-fio [scrollbar-width:none]" aria-label="Seções desta página">
      {abas.map((a) => {
        const eAtiva = a.chave === ativa;
        return (
          <Link
            key={a.chave}
            href={a.href}
            aria-current={eAtiva ? "page" : undefined}
            className={cn(
              "relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              eAtiva ? "border-brilho text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
            {a.numero !== undefined && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold num", eAtiva ? "bg-azul/25 text-ciano" : "bg-white/[0.06]")}>
                {a.numero.toLocaleString("pt-BR")}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
