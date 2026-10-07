"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, Mail, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Conectar e desconectar o Gmail.
 *
 * Conectar é um link, não um fetch: o OAuth precisa navegar até o Google
 * e voltar. Desconectar apaga o token cifrado do banco — e recomenda
 * revogar também no Google, porque apagar aqui não revoga lá.
 */
export function ConexaoGoogle({
  conta,
}: {
  conta: { email: string; conectadoEm: string; ultimoErro: string | null } | null;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function desconectar() {
    setOcupado(true);
    try {
      const r = await fetch("/api/google/desconectar", { method: "POST" });
      if (!r.ok) {
        toast.error("Não consegui desconectar.");
        return;
      }
      toast.success("Gmail desconectado. Revogue também em myaccount.google.com/permissions.");
      router.refresh();
    } catch {
      toast.error("Falha de rede ao desconectar.");
    } finally {
      setOcupado(false);
    }
  }

  if (conta === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Nenhuma conta conectada. A ferramenta pede só a permissão de <strong>enviar</strong> —
          não lê sua caixa de entrada, não acessa contatos, não apaga nada.
        </p>
        <Button
          render={<a href="/api/google/conectar" />}
          nativeButton={false}
          className="h-11 w-fit cursor-pointer gap-2"
        >
          <Mail className="size-4" aria-hidden="true" />
          Conectar Gmail
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Conectado como <span className="font-semibold text-acento">{conta.email}</span>
        <span className="num text-muted-foreground"> · desde {conta.conectadoEm.slice(0, 10)}</span>
      </p>

      {conta.ultimoErro && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Último erro de envio: {conta.ultimoErro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          render={<a href="/api/google/conectar" />}
          nativeButton={false}
          variant="secondary"
          className="h-11 cursor-pointer gap-2"
        >
          <Mail className="size-4" aria-hidden="true" />
          Reconectar
        </Button>
        <Button
          onClick={desconectar}
          disabled={ocupado}
          variant="ghost"
          className="h-11 cursor-pointer gap-2 text-muted-foreground"
        >
          {ocupado ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Unplug className="size-4" aria-hidden="true" />
          )}
          Desconectar
        </Button>
      </div>
    </div>
  );
}
