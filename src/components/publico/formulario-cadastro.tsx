"use client";

import { AlertCircle, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarPreco, type IdPlano } from "@/lib/planos";
import { cn } from "@/lib/utils";
import { cadastrar } from "@/server/acoes-auth";
import { ESTADO_INICIAL } from "@/server/estado-acao";

type PlanoResumo = { id: IdPlano; nome: string; precoCentavos: number; destaque: boolean };

function mascararTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export function FormularioCadastro({ planos, planoInicial, origem }: { planos: PlanoResumo[]; planoInicial: IdPlano; origem: string }) {
  const [estado, acao, pendente] = useActionState(cadastrar, ESTADO_INICIAL);
  const [plano, setPlano] = useState<IdPlano>(planoInicial);
  const [verSenha, setVerSenha] = useState(false);
  const [telefone, setTelefone] = useState("");

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="plano" value={plano} />
      {origem && <input type="hidden" name="origem" value={origem} />}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Plano para testar</legend>
        <div className="grid grid-cols-3 gap-2">
          {planos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlano(p.id)}
              aria-pressed={plano === p.id}
              className={cn(
                "relative cursor-pointer rounded-xl border px-2 py-2.5 text-center transition-colors",
                plano === p.id ? "border-brilho/70 bg-azul/10" : "border-fio hover:border-brilho/35",
              )}
            >
              {p.destaque && <Sparkles className="absolute right-1.5 top-1.5 size-3 text-ciano" aria-label="Mais escolhido" />}
              <span className="block text-sm font-semibold">{p.nome}</span>
              <span className="num block text-xs text-muted-foreground">{formatarPreco(p.precoCentavos)}/mês</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cad-nome">Seu nome</Label>
          <Input id="cad-nome" name="nome" autoComplete="name" required className="h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cad-empresa">Nome da sua empresa</Label>
          <Input id="cad-empresa" name="empresa" autoComplete="organization" placeholder="Opcional" className="h-11" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cad-email">E-mail</Label>
        <Input id="cad-email" name="email" type="email" autoComplete="email" required className="h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cad-tel">WhatsApp</Label>
        <Input id="cad-tel" name="telefone" type="tel" inputMode="tel" autoComplete="tel" value={telefone} onChange={(e) => setTelefone(mascararTelefone(e.target.value))} placeholder="(92) 99999-9999" className="h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cad-senha">Senha</Label>
        <div className="relative">
          <Input id="cad-senha" name="senha" type={verSenha ? "text" : "password"} autoComplete="new-password" required minLength={8} className="h-11 pr-11" aria-describedby="cad-senha-dica" />
          <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute inset-y-0 right-0 flex size-11 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground" aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={verSenha}>
            {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p id="cad-senha-dica" className="text-xs text-muted-foreground">
          Pelo menos 8 caracteres, com letras e números.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" name="aceite" required className="mt-1 accent-[#ff5a1f]" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-foreground underline underline-offset-2">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="text-foreground underline underline-offset-2">
            Política de privacidade
          </Link>
          .
        </span>
      </label>

      {estado.mensagem && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {estado.mensagem}
        </p>
      )}

      <Button type="submit" disabled={pendente} className="h-11 w-full cursor-pointer">
        {pendente ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Criando sua conta…
          </>
        ) : (
          "Criar conta e começar"
        )}
      </Button>
    </form>
  );
}
