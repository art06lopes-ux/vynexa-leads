"use client";

import { LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Pessoa = { id: string; nome: string; email: string; papel: string; ultimo_acesso_em: string | null };

/** Pessoas com login na conta. O titular adiciona com uma senha provisória e passa para a pessoa. */
export function Equipe({ pessoas, limite, titular }: { pessoas: Pessoa[]; limite: number | null; titular: boolean }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const cheio = limite !== null && pessoas.length >= limite;

  async function chamar(metodo: "POST" | "DELETE", corpo: unknown, chave: string, sucesso: string) {
    setOcupado(chave);
    try {
      const r = await fetch("/api/equipe", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; campos?: Array<{ mensagem: string }> };
      if (!r.ok) throw new Error(d.campos?.[0]?.mensagem ?? d.erro ?? "Falhou.");
      toast.success(sucesso);
      if (metodo === "POST") {
        setNome("");
        setEmail("");
        setSenha("");
      }
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-fio rounded-xl border border-fio">
        {pessoas.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-azul/15 font-semibold text-ciano">{p.nome.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
            </span>
            <span className="text-xs text-muted-foreground">{p.papel === "dono" ? "Titular" : "Equipe"}</span>
            {titular && p.papel !== "dono" && (
              <button type="button" onClick={() => chamar("DELETE", { id: p.id }, p.id, `${p.nome} saiu da conta.`)} disabled={!!ocupado} className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-perigo/10 hover:text-perigo" aria-label={`Remover ${p.nome}`}>
                {ocupado === p.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {pessoas.length} de {limite ?? "∞"} pessoa(s) do seu plano. Cada pessoa vê a mesma carteira de leads e o mesmo CRM.
      </p>

      {titular &&
        (cheio ? (
          <p className="rounded-xl border border-fio p-4 text-sm text-muted-foreground">O plano atual já está com todas as vagas. Para chamar mais gente, troque de plano em Assinatura.</p>
        ) : (
          <form
            className="grid grid-cols-1 gap-3 rounded-xl border border-fio p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              chamar("POST", { nome, email, senha }, "novo", `${nome} já pode entrar com o e-mail e a senha que você criou.`);
            }}
          >
            <div>
              <Label htmlFor="eq-nome">Nome</Label>
              <Input id="eq-nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="mt-1.5 h-10" />
            </div>
            <div>
              <Label htmlFor="eq-email">E-mail</Label>
              <Input id="eq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 h-10" />
            </div>
            <div>
              <Label htmlFor="eq-senha">Senha provisória</Label>
              <Input id="eq-senha" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5 h-10" />
            </div>
            <Button type="submit" disabled={!!ocupado} className="cursor-pointer sm:col-span-3 sm:justify-self-start">
              {ocupado === "novo" ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Adicionar à equipe
            </Button>
          </form>
        ))}
    </div>
  );
}
