"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar } from "@/server/acoes-auth";
import { ESTADO_INICIAL } from "@/server/estado-acao";

export function FormularioLogin({ destino }: { destino?: string }) {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);
  const [verSenha, setVerSenha] = useState(false);
  const idSenha = useId();
  const idErro = useId();

  return (
    <Card className="vidro">
      <CardContent className="pt-6">
        <form action={acao} className="flex flex-col gap-4">
          {destino && <input type="hidden" name="destino" value={destino} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor={idSenha}>Senha de acesso</Label>
            <div className="relative">
              <Input
                id={idSenha}
                name="senha"
                type={verSenha ? "text" : "password"}
                autoComplete="current-password"
                required
                autoFocus
                className="h-11 pr-11"
                aria-invalid={estado.mensagem !== null}
                aria-describedby={estado.mensagem ? idErro : undefined}
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                // 44px de alvo: a regra de toque vale para o botão dentro
                // do campo tanto quanto para os de fora.
                className="absolute inset-y-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors duration-200 hover:text-foreground"
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={verSenha}
              >
                {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* O erro fica junto do campo, não numa faixa no topo, e é
              anunciado por leitor de tela quando aparece. */}
          {estado.mensagem && (
            <p
              id={idErro}
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {estado.mensagem}
            </p>
          )}

          <Button type="submit" disabled={pendente} className="mt-1 h-11 w-full cursor-pointer">
            {pendente ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden="true" />
                Entrar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
