"use client";

import { AlertCircle, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pedirRedefinicao, redefinirSenha } from "@/server/acoes-auth";
import { ESTADO_INICIAL } from "@/server/estado-acao";

export function FormularioSenha({ modo, token }: { modo: "pedir" | "redefinir"; token?: string }) {
  const [estado, acao, pendente] = useActionState(modo === "pedir" ? pedirRedefinicao : redefinirSenha, ESTADO_INICIAL);

  if (estado.sucesso) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-sucesso/30 bg-sucesso/10 p-4 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-sucesso" aria-hidden="true" />
        {estado.sucesso}
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      {token && <input type="hidden" name="token" value={token} />}
      {modo === "pedir" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha-email">E-mail da conta</Label>
          <Input id="senha-email" name="email" type="email" autoComplete="email" required autoFocus className="h-11" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha-nova">Senha nova</Label>
          <Input id="senha-nova" name="senha" type="password" autoComplete="new-password" minLength={8} required autoFocus className="h-11" />
          <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres, com letras e números.</p>
        </div>
      )}
      {estado.mensagem && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {estado.mensagem}
        </p>
      )}
      <Button type="submit" disabled={pendente} className="h-11 w-full cursor-pointer">
        {pendente && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {modo === "pedir" ? "Mandar o link" : "Salvar e entrar"}
      </Button>
    </form>
  );
}
