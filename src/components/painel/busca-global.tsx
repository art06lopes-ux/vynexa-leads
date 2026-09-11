"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Busca do topo. Leva para a listagem já filtrada.
 *
 * Não é autocomplete: cada tecla viraria uma consulta ao Turso, e o
 * atalho de teclado com Enter resolve o mesmo problema sem esse custo.
 */
export function BuscaGlobal() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K põe o cursor no campo, como em toda ferramenta de
  // trabalho. Só isso: nenhum outro atalho é capturado.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        campo.current?.focus();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = texto.trim();
        router.push(q === "" ? "/empresas" : `/empresas?q=${encodeURIComponent(q)}`);
      }}
      className="relative w-full max-w-md"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar empresa, segmento ou cidade"
        aria-label="Buscar na carteira"
        className="h-11 w-full rounded-full border border-input bg-card/50 pl-10 pr-16 text-sm transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-ring"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}
