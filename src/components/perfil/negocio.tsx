"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Handshake, LoaderCircle, Printer, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { PropostaLead, VendaLead } from "@/db/leads";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";

import { acaoLead } from "./acao";

type Produto = { id: string; nome: string; preco_centavos: number; moeda: string };

const ROTULO_PROPOSTA: Record<string, string> = { rascunho: "Rascunho", enviada: "Enviada", aceita: "Aceita", recusada: "Recusada" };
const campo = "h-9 w-full rounded-lg border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60";

/** Propostas e venda: a parte do perfil que fecha o ciclo. */
export function PainelNegocio({
  leadId,
  propostas,
  vendas,
  produtos,
  produtoSugerido,
  iaConfigurada,
  empresa,
}: {
  leadId: string;
  propostas: PropostaLead[];
  vendas: VendaLead[];
  produtos: Produto[];
  produtoSugerido: string | null;
  iaConfigurada: boolean;
  empresa: string;
}) {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [produtoId, setProdutoId] = useState(produtoSugerido ?? produtos[0]?.id ?? "");
  const [vendendo, setVendendo] = useState(false);
  const [venda, setVenda] = useState({ descricao: "", valor: "", meio: "pix", pago: false, clienteNome: "", clienteDocumento: "" });
  const [salvando, setSalvando] = useState(false);

  async function gerarProposta() {
    setGerando(true);
    const r = await acaoLead<{ id: string }>(leadId, { acao: "proposta", produtoId: produtoId || null });
    setGerando(false);
    if (r) {
      toast.success("Proposta gerada.");
      router.refresh();
    }
  }

  async function status(propostaId: string, s: string) {
    const r = await acaoLead(leadId, { acao: "proposta_status", propostaId, status: s });
    if (r) {
      toast.success(`Proposta marcada como ${ROTULO_PROPOSTA[s].toLowerCase()}.`);
      router.refresh();
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const produto = produtos.find((p) => p.id === produtoId);
    const r = await acaoLead(leadId, {
      acao: "venda",
      produtoId: produto?.id ?? null,
      descricao: venda.descricao || produto?.nome || "Venda",
      valor: venda.valor,
      meio: venda.meio,
      pago: venda.pago,
      clienteNome: venda.clienteNome || undefined,
      clienteDocumento: venda.clienteDocumento || undefined,
    });
    setSalvando(false);
    if (r) {
      toast.success(venda.pago ? "Venda registrada como paga." : "Venda registrada. Emita a cobrança em Pagamentos.");
      setVendendo(false);
      router.refresh();
    }
  }

  return (
    <section className="placa p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className="pastilha size-8">
          <Handshake className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[0.95rem] font-semibold">Proposta e venda</h2>
          <p className="text-xs text-muted-foreground">Gere a proposta pelo produto do catálogo e registre o fechamento.</p>
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={cn(campo, "w-auto min-w-48 flex-1 cursor-pointer")} aria-label="Produto">
            {produtos.length === 0 && <option value="">Cadastre produtos em Configurações</option>}
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.preco_centavos > 0 ? ` — ${formatarDinheiro(p.preco_centavos, p.moeda)}` : ""}
                {p.id === produtoSugerido ? " (sugerido pela IA)" : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={gerarProposta} disabled={gerando || !iaConfigurada} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-brilho/40 bg-azul/15 px-3 text-sm text-[#c4d3ff] hover:bg-azul/25 disabled:opacity-50">
            {gerando ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />} Gerar proposta
          </button>
        </div>

        {propostas.length > 0 && (
          <ul className="space-y-2">
            {propostas.map((p) => (
              <li key={p.id} className="rounded-xl border border-fio p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROTULO_PROPOSTA[p.status]} · {p.valor_centavos ? formatarDinheiro(p.valor_centavos) : "valor a definir"}
                    </p>
                  </div>
                  <Link href={`/leads/${leadId}/proposta/${p.id}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-fio hover:bg-white/5" aria-label="Ver e imprimir proposta">
                    <Printer className="size-4" />
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["enviada", "aceita", "recusada"] as const).map((s) => (
                    <button key={s} type="button" disabled={p.status === s} onClick={() => status(p.id, s)} className="h-7 cursor-pointer rounded-md border border-fio px-2 text-xs hover:bg-white/5 disabled:border-brilho/40 disabled:bg-azul/15 disabled:text-ciano">
                      {ROTULO_PROPOSTA[s]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {vendas.length > 0 && (
          <ul className="space-y-1.5">
            {vendas.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-xl border border-sucesso/25 bg-sucesso/[0.06] px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Trophy className="size-4 text-sucesso" /> {v.descricao}
                </span>
                <span className="font-semibold num">
                  {formatarDinheiro(v.valor_centavos, v.moeda)} <span className="text-xs font-normal text-muted-foreground">· {v.status === "pago" ? "pago" : v.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={() => setVendendo((v) => !v)} className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-sucesso/90 text-sm font-semibold text-[#03210f] hover:bg-sucesso">
          <Trophy className="size-4" /> Registrar venda (ganho)
        </button>

        <AnimatePresence>
          {vendendo && (
            <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden" onSubmit={registrar}>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="col-span-2 space-y-1">
                  <span className="rotulo">Descrição</span>
                  <input value={venda.descricao} onChange={(e) => setVenda((a) => ({ ...a, descricao: e.target.value }))} placeholder={produtos.find((p) => p.id === produtoId)?.nome ?? "Site Profissional"} className={campo} />
                </label>
                <label className="space-y-1">
                  <span className="rotulo">Valor (R$)</span>
                  <input required value={venda.valor} onChange={(e) => setVenda((a) => ({ ...a, valor: e.target.value }))} placeholder={(() => { const p = produtos.find((x) => x.id === produtoId); return p && p.preco_centavos > 0 ? String(p.preco_centavos / 100).replace(".", ",") : "350,00"; })()} inputMode="decimal" className={campo} />
                </label>
                <label className="space-y-1">
                  <span className="rotulo">Pagamento</span>
                  <select value={venda.meio} onChange={(e) => setVenda((a) => ({ ...a, meio: e.target.value }))} className={cn(campo, "cursor-pointer")}>
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="rotulo">Cliente (pessoa)</span>
                  <input value={venda.clienteNome} onChange={(e) => setVenda((a) => ({ ...a, clienteNome: e.target.value }))} placeholder={`Responsável pela ${empresa}`} className={campo} />
                </label>
                <label className="space-y-1">
                  <span className="rotulo">CPF/CNPJ (para cobrança)</span>
                  <input value={venda.clienteDocumento} onChange={(e) => setVenda((a) => ({ ...a, clienteDocumento: e.target.value }))} inputMode="numeric" className={campo} />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={venda.pago} onChange={(e) => setVenda((a) => ({ ...a, pago: e.target.checked }))} className="size-4 accent-[#2bd47d]" />
                Já foi pago (sem cobrança pelo Asaas)
              </label>
              <button type="submit" disabled={salvando} className="h-10 w-full cursor-pointer rounded-xl bg-azul text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60">
                {salvando ? "Registrando…" : "Confirmar venda"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
