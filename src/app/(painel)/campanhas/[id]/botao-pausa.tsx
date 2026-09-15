"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StatusCampanha } from "@/db/campanhas";

export function BotaoPausa({ id, status }: { id: string; status: StatusCampanha }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  if (status !== "em_envio" && status !== "pausada") return null;
  const pausada = status === "pausada";

  async function alternar() {
    setOcupado(true);
    try {
      const r = await fetch(`/api/campanhas/${id}/pausa`, { method: "POST" });
      if (!r.ok) {
        toast.error("Não consegui alterar a campanha.");
        return;
      }
      toast.success(pausada ? "Envio retomado." : "Envio pausado.");
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button
      onClick={alternar}
      disabled={ocupado}
      variant="secondary"
      className="h-11 cursor-pointer gap-2"
    >
      {ocupado ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : pausada ? (
        <Play className="size-4" aria-hidden="true" />
      ) : (
        <Pause className="size-4" aria-hidden="true" />
      )}
      {pausada ? "Retomar envio" : "Pausar envio"}
    </Button>
  );
}
