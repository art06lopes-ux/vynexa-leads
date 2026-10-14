"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Projeto } from "@/db/carteira";
import { ROTULO_STATUS_PROJETO, ROTULO_TIPO, STATUS_PROJETO, TIPOS_PROJETO } from "@/lib/projetos";
import { cn } from "@/lib/utils";

export type OpcaoCliente = { id: string; nome: string };

const campo = "h-10 w-full rounded-xl border border-fio bg-tinta/60 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brilho/60";

function reais(c: number): string {
  return c > 0 ? (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

/** Criar ou editar um projeto. `projeto` nulo = novo. */
export function FormProjeto({
  aberto,
  aoFechar,
  projeto,
  clientes,
  leadInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  projeto: Projeto | null;
  clientes: OpcaoCliente[];
  leadInicial?: string | null;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(form: FormData) {
    setSalvando(true);
    setErro(null);
    const leadId = String(form.get("leadId") ?? "");
    const corpo = {
      nome: String(form.get("nome") ?? ""),
      leadId: leadId || null,
      clienteNome: leadId ? clientes.find((c) => c.id === leadId)?.nome ?? null : String(form.get("clienteNome") ?? "") || null,
      tipo: String(form.get("tipo")),
      status: String(form.get("status")),
      url: String(form.get("url") ?? ""),
      prazo: String(form.get("prazo") ?? "") || null,
      valor: String(form.get("valor") ?? ""),
      custo: String(form.get("custo") ?? ""),
      observacoes: String(form.get("observacoes") ?? ""),
    };
    try {
      const r = await fetch(projeto ? `/api/projetos/${projeto.id}` : "/api/projetos", {
        method: projeto ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = (await r.json()) as { erro?: string; campos?: Array<{ campo: string; mensagem: string }> };
      if (!r.ok) {
        setErro(d.campos?.[0]?.mensagem ?? d.erro ?? "Não foi possível salvar.");
        return;
      }
      toast.success(projeto ? "Projeto atualizado." : "Projeto adicionado.");
      aoFechar();
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border border-fio bg-placa p-5 sm:max-w-xl">
        <DialogTitle className="text-lg font-semibold">{projeto ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        <DialogDescription className="-mt-2 text-sm text-muted-foreground">Site, landing page ou sistema — com prazo, valor e custo para a margem aparecer no Início.</DialogDescription>
        <form
          key={projeto?.id ?? "novo"}
          action={(f) => void salvar(f)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Nome do projeto</span>
            <input name="nome" required minLength={2} defaultValue={projeto?.nome ?? ""} placeholder="Site institucional da Barbearia X" className={campo} autoFocus />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Cliente da carteira</span>
            <select name="leadId" defaultValue={projeto?.lead_id ?? leadInicial ?? ""} className={cn(campo, "cursor-pointer")}>
              <option value="">Nenhum (digitar ao lado)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Ou nome do cliente</span>
            <input name="clienteNome" defaultValue={projeto?.lead_id ? "" : projeto?.cliente_nome ?? ""} placeholder="Nome ou empresa" className={campo} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Tipo</span>
            <select name="tipo" defaultValue={projeto?.tipo ?? "site"} className={cn(campo, "cursor-pointer")}>
              {TIPOS_PROJETO.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Status</span>
            <select name="status" defaultValue={projeto?.status ?? "desenvolvimento"} className={cn(campo, "cursor-pointer")}>
              {STATUS_PROJETO.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_PROJETO[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Endereço do site</span>
            <input name="url" defaultValue={projeto?.url ?? ""} placeholder="cliente.vercel.app" className={campo} inputMode="url" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Valor cobrado (R$)</span>
            <input name="valor" defaultValue={reais(projeto?.valor_centavos ?? 0)} placeholder="1.500,00" inputMode="decimal" className={campo} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Custo (R$)</span>
            <input name="custo" defaultValue={reais(projeto?.custo_centavos ?? 0)} placeholder="Domínio, hospedagem…" inputMode="decimal" className={campo} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Prazo de entrega</span>
            <input name="prazo" type="date" defaultValue={projeto?.prazo ?? ""} className={cn(campo, "[color-scheme:dark]")} />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Observações</span>
            <textarea name="observacoes" defaultValue={projeto?.observacoes ?? ""} rows={3} className={cn(campo, "h-auto resize-y py-2")} placeholder="O que falta, acessos, combinados com o cliente…" />
          </label>
          {erro && (
            <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo sm:col-span-2">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={aoFechar} className="h-10 cursor-pointer rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-5 text-sm font-semibold text-sobre-brasa hover:bg-brilho disabled:opacity-60">
              {salvando && <LoaderCircle className="size-4 animate-spin" />}
              {projeto ? "Salvar alterações" : "Adicionar projeto"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
