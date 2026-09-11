"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { AlertCircle, BadgeCheck, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cadastrarVendaManual } from "@/server/acoes-vendas";
import { ESTADO_INICIAL } from "@/server/estado-acao";
import { cn } from "@/lib/utils";

const MEIOS = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "transferencia", rotulo: "Transferência" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "outro", rotulo: "Outro" },
] as const;

/**
 * Cadastro de venda já paga — a função principal desta tela.
 *
 * O formulário limpa sozinho depois do sucesso, porque o uso real é
 * "fechei três sites hoje, vou lançar os três": sobrar o anterior
 * preenchido é o jeito mais fácil de lançar o mesmo duas vezes.
 */
export function FormularioVendaManual() {
  const [estado, acao, pendente] = useActionState(cadastrarVendaManual, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const idBase = useId();

  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!estado.mensagem) return;
    if (estado.mensagem.startsWith("Venda de")) {
      toast.success(estado.mensagem);
      formulario.current?.reset();
    }
  }, [estado]);

  const ehErro = estado.mensagem !== null && !estado.mensagem.startsWith("Venda de");

  return (
    <Card className="vidro brasa">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="size-4 text-emerald-300" aria-hidden="true" />
          Registrar venda paga
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form ref={formulario} action={acao} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-desc`}>O que foi vendido</Label>
            <Input
              id={`${idBase}-desc`}
              name="descricao"
              placeholder="Site institucional — Barbearia do João"
              maxLength={200}
              required
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-valor`}>Valor recebido</Label>
              <Input
                id={`${idBase}-valor`}
                name="valor"
                placeholder="1.297,00"
                inputMode="decimal"
                required
                className="num h-11"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-data`}>Data do pagamento</Label>
              <Input
                id={`${idBase}-data`}
                name="data"
                type="date"
                defaultValue={hoje}
                max={hoje}
                className="num h-11"
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Como o cliente pagou</legend>
            <div
              role="radiogroup"
              aria-label="Meio de pagamento"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {MEIOS.map((m, i) => (
                <label
                  key={m.valor}
                  className={cn(
                    "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-200",
                    "border-border text-muted-foreground hover:border-input hover:text-foreground",
                    "has-checked:border-primary/60 has-checked:bg-primary/12 has-checked:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="meio"
                    value={m.valor}
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  {m.rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-cliente`}>Cliente</Label>
            <Input
              id={`${idBase}-cliente`}
              name="clienteNome"
              placeholder="opcional"
              maxLength={120}
              className="h-11"
              autoComplete="off"
            />
          </div>

          {ehErro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {estado.mensagem}
            </p>
          )}

          <Button type="submit" disabled={pendente} className="h-11 cursor-pointer gap-2">
            {pendente ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Registrando…
              </>
            ) : (
              <>
                <BadgeCheck className="size-4" aria-hidden="true" />
                Registrar venda
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
