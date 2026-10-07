"use client";

import { Printer } from "lucide-react";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
      <Printer className="size-4" /> Imprimir ou salvar PDF
    </button>
  );
}
