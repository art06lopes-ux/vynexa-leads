"use client";

import { createContext, useCallback, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Mail, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Seleção de empresas para campanha.
 *
 * Um contexto envolve a tabela (que é Server Component); cada linha
 * recebe uma caixa cliente, e a barra flutuante lê o total. Assim a
 * tabela continua renderizada no servidor, e só o que é interativo
 * vira JavaScript no navegador.
 */

type Contexto = {
  selecionados: Set<string>;
  alternar: (id: string) => void;
  limpar: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export function SelecaoProvider({ children }: { children: ReactNode }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());

  const alternar = useCallback((id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const limpar = useCallback(() => setSelecionados(new Set()), []);
  const valor = useMemo(() => ({ selecionados, alternar, limpar }), [selecionados, alternar, limpar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function CaixaSelecao({ id, nome, temEmail }: { id: string; nome: string; temEmail: boolean }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;

  return (
    <input
      type="checkbox"
      checked={ctx.selecionados.has(id)}
      onChange={() => ctx.alternar(id)}
      disabled={!temEmail}
      // Sem e-mail não entra em campanha; o título explica em vez de a
      // caixa simplesmente não funcionar.
      title={temEmail ? `Selecionar ${nome}` : `${nome} não tem e-mail — não entra em campanha`}
      aria-label={`Selecionar ${nome} para campanha`}
      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

export function BarraCampanha() {
  const ctx = useContext(Ctx);
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const idNome = useId();

  if (!ctx || ctx.selecionados.size === 0) return null;
  const total = ctx.selecionados.size;

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    try {
      const r = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), empresaIds: [...ctx!.selecionados] }),
      });
      const dados = (await r.json()) as { id?: string; incluidas?: number; semEmail?: number; erro?: string };

      if (!r.ok || !dados.id) {
        toast.error(dados.erro ?? "Não consegui criar a campanha.");
        return;
      }

      toast.success(
        `Campanha criada com ${dados.incluidas} empresa(s). Os e-mails estão sendo escritos pela IA.`,
      );
      ctx!.limpar();
      router.push(`/campanhas/${dados.id}`);
    } catch {
      toast.error("Falha de rede ao criar a campanha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    // Acima do dock, para os dois não brigarem pelo mesmo canto.
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
      <div className="vidro brasa pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <p className="num text-sm">
          <span className="font-semibold text-acento">{total}</span> selecionada{total > 1 ? "s" : ""}
        </p>

        <Dialog>
          <DialogTrigger render={<Button className="h-10 cursor-pointer gap-2" />}>
            <Mail className="size-4" aria-hidden="true" />
            Criar campanha de e-mail
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova campanha</DialogTitle>
              <DialogDescription>
                A IA escreve um e-mail para cada empresa, no idioma dela. O envio sai pelo seu Gmail,
                com pausa entre cada um e teto de 100 por dia.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={criar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={idNome}>Nome da campanha</Label>
                <Input
                  id={idNome}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Barbearias de Contagem · setembro"
                  required
                  minLength={3}
                  className="h-11"
                  autoFocus
                />
              </div>

              <Button type="submit" disabled={enviando} className="h-11 cursor-pointer gap-2">
                {enviando ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="size-4" aria-hidden="true" />
                )}
                Criar e começar a escrever
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          onClick={ctx.limpar}
          className="h-10 cursor-pointer text-muted-foreground"
          aria-label="Limpar seleção"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
