"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { gerarAbordagem } from "@/server/acoes-leads";
import { cn } from "@/lib/utils";

/**
 * Gera a mensagem de abordagem de uma empresa na hora, sem esperar o
 * worker chegar nela pela fila.
 */
export function BotaoGerarAbordagem({ empresaId, className }: { empresaId: string; className?: string }) {
  const [gerando, iniciar] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={gerando}
      onClick={() =>
        iniciar(async () => {
          const r = await gerarAbordagem(empresaId);
          if (!r.ok) toast.error(r.erro ?? "Não consegui gerar a abordagem.");
        })
      }
      className={cn("h-9 cursor-pointer gap-1.5 px-2.5 text-xs", className)}
    >
      {gerando ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="size-3.5" aria-hidden="true" />
      )}
      Gerar abordagem
    </Button>
  );
}
