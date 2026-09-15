"use client";

import { useActionState, useEffect, useId } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarAjustes } from "@/server/acoes-ajustes";
import { ESTADO_INICIAL } from "@/server/estado-acao";

export function FormularioReceita({ ufs }: { ufs: string }) {
  const [estado, acao, pendente] = useActionState(salvarAjustes, ESTADO_INICIAL);
  const id = useId();

  useEffect(() => {
    if (estado.mensagem) toast.success(estado.mensagem);
  }, [estado]);

  return (
    <form action={acao} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={id}>Estados a importar</Label>
        <Input
          id={id}
          name="receita_ufs"
          defaultValue={ufs}
          placeholder="AM, PA, SP"
          maxLength={120}
          className="h-11 uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Siglas separadas por vírgula. Cada estado ocupa de 50 a 800 MB no banco; o plano
          gratuito do Turso tem 5 GB — SP sozinho fica perto de 2 GB.
        </p>
      </div>
      <Button type="submit" disabled={pendente} className="h-11 cursor-pointer gap-2">
        {pendente ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        Salvar estados
      </Button>
    </form>
  );
}
