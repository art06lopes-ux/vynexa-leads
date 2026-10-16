"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  conta: { id: string; nome: string; plano: string; status: string; observacao: string | null; semBanco: boolean; temAssinatura: boolean };
};

const campo = "h-10 w-full rounded-lg border border-fio bg-placa px-3 text-sm outline-none focus-visible:border-brilho/60";

/** Ações do dono sobre uma conta: plano, prazo, bloqueio, anotação, exclusão. */
export function AcoesMembro({ conta }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [plano, setPlano] = useState(conta.plano);
  const [status, setStatus] = useState(conta.status);
  const [dias, setDias] = useState("30");
  const [obs, setObs] = useState(conta.observacao ?? "");
  const [confirmacao, setConfirmacao] = useState("");

  async function chamar(chave: string, metodo: "PATCH" | "POST" | "DELETE", corpo: unknown, sucesso: string, depois?: () => void) {
    setOcupado(chave);
    try {
      const r = await fetch(`/api/admin/contas/${conta.id}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; campos?: Array<{ mensagem: string }> };
      if (!r.ok) throw new Error(d.campos?.[0]?.mensagem ?? d.erro ?? "Falhou.");
      toast.success(sucesso);
      if (depois) depois();
      else router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setOcupado(null);
    }
  }

  const carregando = (chave: string) => ocupado === chave && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />;

  return (
    <aside className="space-y-4">
      {conta.semBanco && (
        <section className="rounded-2xl border border-perigo/30 bg-perigo/10 p-4 text-sm">
          <p className="font-semibold text-perigo">O banco desta conta não foi criado.</p>
          <p className="mt-1 text-muted-foreground">Sem ele o cliente não entra. Costuma ser o token do Cloudflare sem a permissão “D1: Edit” ou o limite de 10 bancos do plano grátis.</p>
          <Button type="button" className="mt-3 cursor-pointer" disabled={!!ocupado} onClick={() => chamar("banco", "POST", { acao: "provisionar" }, "Banco criado.")}>
            {carregando("banco")} Tentar criar de novo
          </Button>
        </section>
      )}

      <section className="placa space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Plano e situação</h2>
        <div>
          <Label htmlFor="adm-plano">Plano</Label>
          <select id="adm-plano" value={plano} onChange={(e) => setPlano(e.target.value)} className={`${campo} mt-1.5`}>
            <option value="essencial">Essencial</option>
            <option value="pro">PRO</option>
            <option value="agencia">Agência</option>
          </select>
        </div>
        <div>
          <Label htmlFor="adm-status">Situação</Label>
          <select id="adm-status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${campo} mt-1.5`}>
            <option value="teste">Teste</option>
            <option value="ativa">Ativa</option>
            <option value="atrasada">Atrasada</option>
            <option value="cancelada">Cancelada</option>
            <option value="bloqueada">Bloqueada (sem acesso)</option>
          </select>
        </div>
        <Button type="button" className="w-full cursor-pointer" disabled={!!ocupado || (plano === conta.plano && status === conta.status)} onClick={() => chamar("plano", "PATCH", { plano, status }, "Conta atualizada.")}>
          {carregando("plano")} Salvar plano e situação
        </Button>
        <p className="text-xs text-muted-foreground">Mudar o plano aqui não mexe na cobrança do Asaas. Para o valor mudar, o cliente troca em Assinatura.</p>
      </section>

      <section className="placa space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Prazo de acesso</h2>
        <p className="text-sm text-muted-foreground">Dar dias de cortesia, estender o teste ou liberar quem pagou por fora (Pix direto).</p>
        <div className="flex gap-2">
          <Input type="number" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} aria-label="Dias" className="h-10 w-24" />
          <Button type="button" variant="outline" className="flex-1 cursor-pointer" disabled={!!ocupado || !Number(dias)} onClick={() => chamar("dias", "PATCH", { estenderDias: Number(dias) }, `Prazo ${Number(dias) > 0 ? "estendido" : "reduzido"} em ${Math.abs(Number(dias))} dias.`)}>
            {carregando("dias")} {Number(dias) < 0 ? "Tirar dias" : "Somar dias"}
          </Button>
        </div>
      </section>

      <section className="placa space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Anotação interna</h2>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Ex.: veio da live de 20/10; pediu desconto." aria-label="Anotação interna" />
        <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={!!ocupado || obs === (conta.observacao ?? "")} onClick={() => chamar("obs", "PATCH", { observacao: obs || null }, "Anotação salva.")}>
          {carregando("obs")} Salvar anotação
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-perigo/25 p-5">
        <h2 className="font-display text-base font-semibold text-perigo">Zona de cuidado</h2>
        {conta.temAssinatura && (
          <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={!!ocupado} onClick={() => chamar("cancelar", "POST", { acao: "cancelar_assinatura" }, "Assinatura cancelada no Asaas.")}>
            {carregando("cancelar")} Cancelar a assinatura no Asaas
          </Button>
        )}
        <div>
          <Label htmlFor="adm-excluir">Excluir conta e todos os dados dela (digite EXCLUIR)</Label>
          <div className="mt-1.5 flex gap-2">
            <Input id="adm-excluir" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className="h-10" autoComplete="off" />
            <Button type="button" variant="destructive" className="cursor-pointer" disabled={!!ocupado || confirmacao !== "EXCLUIR"} onClick={() => chamar("excluir", "DELETE", { confirmacao }, "Conta excluída.", () => router.push("/admin/membros"))}>
              {carregando("excluir")} Excluir
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Apaga o banco da conta no Cloudflare. Não tem volta.</p>
        </div>
      </section>
    </aside>
  );
}
