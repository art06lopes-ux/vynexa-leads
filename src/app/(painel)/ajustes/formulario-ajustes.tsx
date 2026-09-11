"use client";

import { useActionState, useEffect, useId } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarAjustes } from "@/server/acoes-ajustes";
import { ESTADO_INICIAL } from "@/server/estado-acao";

export function FormularioAjustes({ valores }: { valores: Record<string, string> }) {
  const [estado, acao, pendente] = useActionState(salvarAjustes, ESTADO_INICIAL);
  const idBase = useId();

  useEffect(() => {
    if (estado.mensagem) toast.success(estado.mensagem);
  }, [estado]);

  return (
    <Card className="vidro">
      <CardHeader>
        <CardTitle className="text-base">Sua empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-nome`}>Nome da empresa</Label>
              <Input
                id={`${idBase}-nome`}
                name="empresa_nome"
                defaultValue={valores.empresa_nome ?? ""}
                maxLength={120}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Aparece nas mensagens que a IA escreve para os leads.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-moeda`}>Moeda padrão</Label>
              <Input
                id={`${idBase}-moeda`}
                name="moeda_padrao"
                defaultValue={valores.moeda_padrao ?? "BRL"}
                maxLength={3}
                className="h-11 uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Código de três letras usado nos links de cobrança.
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" disabled={pendente} className="h-11 cursor-pointer gap-2">
              {pendente ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
