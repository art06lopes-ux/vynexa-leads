"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Enfileira a análise de IA.
 *
 * Como a busca, não faz o trabalho: só cria o job. Quem chama o Gemini é
 * o worker no GitHub Actions, que tem tempo para as vinte chamadas que
 * uma rodada leva.
 */
export function BotaoAnalisar({ pendentes }: { pendentes: number }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  if (pendentes === 0) return null;

  async function analisar() {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/analisar", { method: "POST" });
      const dados = (await resposta.json()) as {
        enfileirado?: boolean;
        jaNaFila?: boolean;
        pendentes?: number;
        erro?: string;
      };

      if (!resposta.ok) {
        toast.error(dados.erro ?? "Não consegui enfileirar a análise.");
        return;
      }

      if (dados.jaNaFila) {
        toast.info("Já existe uma análise na fila. Ela continua sozinha a cada 5 minutos.");
        return;
      }

      toast.success(
        `Análise enfileirada para ${dados.pendentes} empresa(s). O worker processa em lotes de 20.`,
      );
      router.refresh();
    } catch {
      toast.error("Falha de rede ao enfileirar a análise.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Button
      onClick={analisar}
      disabled={enviando}
      variant="secondary"
      className="h-11 cursor-pointer gap-2"
    >
      {enviando ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="size-4" aria-hidden="true" />
      )}
      Analisar {pendentes} com IA
    </Button>
  );
}
