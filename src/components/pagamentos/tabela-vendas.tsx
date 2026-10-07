"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, LoaderCircle, Plus, QrCode, Receipt, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { VendaListada } from "@/db/vendas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  pago: { rotulo: "Pago", classe: "border-sucesso/30 bg-sucesso/10 text-sucesso" },
  pendente: { rotulo: "Pendente", classe: "border-aviso/30 bg-aviso/10 text-aviso" },
  vencido: { rotulo: "Vencido", classe: "border-perigo/30 bg-perigo/10 text-perigo" },
  cancelado: { rotulo: "Cancelado", classe: "border-white/15 bg-white/5 text-muted-foreground" },
  reembolsado: { rotulo: "Estornado", classe: "border-white/15 bg-white/5 text-muted-foreground" },
};

const MEIO: Record<string, string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão", cartao_stripe: "Cartão (Stripe)", transferencia: "Transferência", dinheiro: "Dinheiro", outro: "Outro" };
const campo = "h-9 w-full rounded-lg border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60";

async function acao(id: string, corpo: Record<string, unknown>) {
  const r = await fetch(`/api/vendas/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const d = (await r.json().catch(() => ({}))) as { erro?: string; codigo?: string; link?: string | null };
  if (!r.ok) {
    toast.error(d.erro ?? "Não foi possível concluir.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => (location.href = "/configuracoes?aba=integracoes") } } : undefined);
    return null;
  }
  return d;
}

function FormCobranca({ v, aoFechar, asaasPronto }: { v: VendaListada; aoFechar: () => void; asaasPronto: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(() => ({ forma: "PIX", vencimento: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), nome: v.cliente_nome ?? v.cliente_empresa ?? "", documento: v.cliente_documento ?? "", email: v.cliente_email ?? "", telefone: v.cliente_telefone ?? "" }));
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="grid gap-2 border-t border-fio bg-white/[0.02] p-4 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const d = await acao(v.id, { acao: "cobranca", ...f, email: f.email || null, telefone: f.telefone || null });
        setEnviando(false);
        if (d) {
          toast.success("Cobrança criada no Asaas.");
          if (d.link) void navigator.clipboard.writeText(d.link).then(() => toast("Link de pagamento copiado."));
          aoFechar();
          router.refresh();
        }
      }}
    >
      {!asaasPronto && <p className="text-xs text-aviso sm:col-span-3">O Asaas ainda não está configurado — a cobrança não será criada até você colar a chave em Configurações.</p>}
      <label className="space-y-1">
        <span className="rotulo">Forma</span>
        <select value={f.forma} onChange={(e) => setF((a) => ({ ...a, forma: e.target.value }))} className={cn(campo, "cursor-pointer")}>
          <option value="PIX">Pix</option>
          <option value="BOLETO">Boleto</option>
          <option value="CREDIT_CARD">Cartão</option>
          <option value="UNDEFINED">Cliente escolhe</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="rotulo">Vencimento</span>
        <input type="date" required value={f.vencimento} onChange={(e) => setF((a) => ({ ...a, vencimento: e.target.value }))} className={cn(campo, "[color-scheme:dark]")} />
      </label>
      <label className="space-y-1">
        <span className="rotulo">CPF/CNPJ do cliente</span>
        <input required value={f.documento} onChange={(e) => setF((a) => ({ ...a, documento: e.target.value }))} inputMode="numeric" className={campo} />
      </label>
      <label className="space-y-1">
        <span className="rotulo">Nome do cliente</span>
        <input required value={f.nome} onChange={(e) => setF((a) => ({ ...a, nome: e.target.value }))} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="rotulo">E-mail (opcional)</span>
        <input type="email" value={f.email} onChange={(e) => setF((a) => ({ ...a, email: e.target.value }))} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="rotulo">Celular (opcional)</span>
        <input value={f.telefone} onChange={(e) => setF((a) => ({ ...a, telefone: e.target.value }))} className={campo} />
      </label>
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" disabled={enviando} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60">
          {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <QrCode className="size-4" />} Criar cobrança no Asaas
        </button>
        <button type="button" onClick={aoFechar} className="h-9 cursor-pointer rounded-lg border border-fio px-3 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function TabelaVendas({ vendas, asaasPronto, produtos }: { vendas: VendaListada[]; asaasPronto: boolean; produtos: Array<{ id: string; nome: string; preco_centavos: number }> }) {
  const router = useRouter();
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [f, setF] = useState({ descricao: "", valor: "", produtoId: "", meio: "pix", pago: false, clienteNome: "", clienteEmpresa: "", clienteDocumento: "" });

  return (
    <section className="placa overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="pastilha size-8">
          <Receipt className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[0.95rem] font-semibold">Vendas e cobranças</h2>
          <p className="text-xs text-muted-foreground">O status muda sozinho quando o Asaas avisa o pagamento.</p>
        </div>
        <button type="button" onClick={() => setNova((n) => !n)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho">
          <Plus className="size-4" /> Registrar venda
        </button>
      </header>

      <AnimatePresence>
        {nova && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await fetch("/api/vendas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, produtoId: f.produtoId || null, descricao: f.descricao || produtos.find((p) => p.id === f.produtoId)?.nome || "" }) });
              const d = (await r.json()) as { erro?: string };
              if (!r.ok) return void toast.error(d.erro ?? "Não foi possível registrar.");
              toast.success("Venda registrada.");
              setNova(false);
              router.refresh();
            }}
          >
            <div className="grid gap-2 border-y border-fio bg-white/[0.02] p-4 sm:grid-cols-4">
              <label className="space-y-1 sm:col-span-2">
                <span className="rotulo">Produto</span>
                <select value={f.produtoId} onChange={(e) => setF((a) => ({ ...a, produtoId: e.target.value }))} className={cn(campo, "cursor-pointer")}>
                  <option value="">Outro (descreva)</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="rotulo">Descrição</span>
                <input value={f.descricao} onChange={(e) => setF((a) => ({ ...a, descricao: e.target.value }))} required={!f.produtoId} className={campo} />
              </label>
              <label className="space-y-1">
                <span className="rotulo">Valor (R$)</span>
                <input required value={f.valor} onChange={(e) => setF((a) => ({ ...a, valor: e.target.value }))} inputMode="decimal" className={campo} />
              </label>
              <label className="space-y-1">
                <span className="rotulo">Cliente</span>
                <input value={f.clienteNome} onChange={(e) => setF((a) => ({ ...a, clienteNome: e.target.value }))} className={campo} />
              </label>
              <label className="space-y-1">
                <span className="rotulo">Empresa</span>
                <input value={f.clienteEmpresa} onChange={(e) => setF((a) => ({ ...a, clienteEmpresa: e.target.value }))} className={campo} />
              </label>
              <label className="space-y-1">
                <span className="rotulo">CPF/CNPJ</span>
                <input value={f.clienteDocumento} onChange={(e) => setF((a) => ({ ...a, clienteDocumento: e.target.value }))} className={campo} />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <input type="checkbox" checked={f.pago} onChange={(e) => setF((a) => ({ ...a, pago: e.target.checked }))} className="size-4 accent-[#2bd47d]" /> Já foi pago
                {f.pago && (
                  <select value={f.meio} onChange={(e) => setF((a) => ({ ...a, meio: e.target.value }))} className={cn(campo, "ml-2 w-40 cursor-pointer")}>
                    {Object.entries(MEIO)
                      .filter(([k]) => k !== "cartao_stripe")
                      .map(([k, r]) => (
                        <option key={k} value={k}>
                          {r}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <button type="submit" className="h-9 cursor-pointer rounded-lg bg-azul text-sm font-semibold text-white hover:bg-brilho">
                Salvar
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {vendas.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma venda ainda. Quando um lead fechar, registre a venda no perfil dele — ou aqui.</p>
      ) : (
        <ul className="divide-y divide-fio border-t border-fio">
          {vendas.map((v) => {
            const s = STATUS[v.status] ?? STATUS.pendente;
            return (
              <li key={v.id}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {v.cliente_empresa ?? v.cliente_nome ?? "Cliente"} <span className="font-normal text-muted-foreground">· {v.produto_nome ?? v.descricao}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.pago_em ? `Pago em ${v.pago_em.slice(0, 10).split("-").reverse().join("/")}` : `Criada em ${v.criado_em.slice(0, 10).split("-").reverse().join("/")}`}
                      {v.meio_pagamento ? ` · ${MEIO[v.meio_pagamento] ?? v.meio_pagamento}` : ""}
                      {v.campanha_nome ? ` · campanha "${v.campanha_nome}"` : ""}
                      {v.cobranca_status ? ` · Asaas: ${v.cobranca_status}${v.cobranca_vencimento ? `, vence ${v.cobranca_vencimento.split("-").reverse().join("/")}` : ""}` : ""}
                    </p>
                  </div>
                  <span className="font-display text-base font-semibold num">{formatarDinheiro(v.valor_centavos, v.moeda)}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", s.classe)}>{s.rotulo}</span>
                  <div className="flex items-center gap-1">
                    {v.lead_id && (
                      <Link href={`/leads/${v.lead_id}`} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/5" aria-label="Abrir lead" title="Abrir lead">
                        <ExternalLink className="size-4" />
                      </Link>
                    )}
                    {v.cobranca_link && (
                      <button type="button" onClick={() => void navigator.clipboard.writeText(v.cobranca_link!).then(() => toast.success("Link de pagamento copiado."))} className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/5" aria-label="Copiar link de pagamento" title="Copiar link de pagamento">
                        <Copy className="size-4" />
                      </button>
                    )}
                    {(v.status === "pendente" || v.status === "vencido") && (
                      <>
                        {!v.cobranca_link && (
                          <button type="button" onClick={() => setCobrando((c) => (c === v.id ? null : v.id))} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-brilho/40 px-2.5 text-xs text-[#c4d3ff] hover:bg-azul/15">
                            <QrCode className="size-3.5" /> Cobrar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const meio = window.prompt("Como foi pago? (pix, boleto, cartao, transferencia, dinheiro, outro)", "pix");
                            if (!meio) return;
                            if (!MEIO[meio]) return void toast.error("Forma de pagamento inválida.");
                            if (await acao(v.id, { acao: "pago", meio })) router.refresh();
                          }}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-sucesso/40 px-2.5 text-xs text-sucesso hover:bg-sucesso/10"
                        >
                          <Check className="size-3.5" /> Marcar pago
                        </button>
                        <button
                          type="button"
                          onClick={async () => window.confirm("Cancelar esta venda? Se houver cobrança no Asaas, cancele-a também lá.") && (await acao(v.id, { acao: "cancelar" })) && router.refresh()}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-perigo"
                          aria-label="Cancelar venda"
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <AnimatePresence>{cobrando === v.id && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden"><FormCobranca v={v} aoFechar={() => setCobrando(null)} asaasPronto={asaasPronto} /></motion.div>}</AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
