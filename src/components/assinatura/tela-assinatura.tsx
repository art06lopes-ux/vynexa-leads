"use client";

import { motion } from "framer-motion";
import { Check, CircleAlert, ExternalLink, LoaderCircle, Lock, Receipt, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPARATIVO, formatarPreco, type IdPlano, type Plano } from "@/lib/planos";
import { cn } from "@/lib/utils";
import type { Fatura } from "@/services/contas";

type Props = {
  conta: { nome: string; plano: IdPlano; status: string; validaAte: string | null; diasRestantes: number | null; documento: string | null; temAssinatura: boolean };
  titular: boolean;
  liberado: boolean;
  planos: Plano[];
  uso: { leads: number; ia: number; google: number };
  faturas: Fatura[];
  cobrancaPronta: boolean;
  pedido: { texto: string; plano: IdPlano } | null;
};

const STATUS: Record<string, { rotulo: string; tom: string }> = {
  teste: { rotulo: "Teste grátis", tom: "bg-azul/15 text-ciano" },
  ativa: { rotulo: "Ativa", tom: "bg-sucesso/15 text-sucesso" },
  atrasada: { rotulo: "Pagamento em aberto", tom: "bg-perigo/15 text-perigo" },
  cancelada: { rotulo: "Cancelada", tom: "bg-white/10 text-muted-foreground" },
  bloqueada: { rotulo: "Bloqueada", tom: "bg-perigo/15 text-perigo" },
};

const STATUS_FATURA: Record<Fatura["status"], string> = {
  pendente: "Aguardando pagamento",
  paga: "Paga",
  atrasada: "Vencida",
  estornada: "Estornada",
  cancelada: "Cancelada",
};

function data(d: string | null): string {
  if (!d) return "—";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

function mascararDocumento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function Barra({ rotulo, usado, limite }: { rotulo: string; usado: number; limite: number | null }) {
  const pct = limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="num font-semibold">
          {usado.toLocaleString("pt-BR")}
          <span className="font-normal text-muted-foreground"> / {limite === null ? "sem limite" : limite.toLocaleString("pt-BR")}</span>
        </span>
      </div>
      {limite !== null && limite > 0 && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className={cn("h-full rounded-full", pct >= 90 ? "bg-perigo" : "bg-gradient-to-r from-[#ff7a45] to-[#ffb347]")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      )}
    </div>
  );
}

export function TelaAssinatura({ conta, titular, liberado, planos, uso, faturas, cobrancaPronta, pedido }: Props) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState<IdPlano>(pedido?.plano ?? (conta.plano === "dono" ? "pro" : conta.plano));
  const [documento, setDocumento] = useState(conta.documento ? mascararDocumento(conta.documento) : "");
  const [enviando, setEnviando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);

  const atual = planos.find((p) => p.id === conta.plano) ?? planos[0];
  const status = STATUS[conta.status] ?? STATUS.ativa;
  const aberta = faturas.find((f) => f.status === "pendente" || f.status === "atrasada");
  const mesmoPlanoPago = escolhido === conta.plano && conta.status === "ativa" && conta.temAssinatura;

  async function pagar() {
    setEnviando(true);
    // Abre a aba já no clique (navegadores bloqueiam janela aberta depois de um await).
    const aba = window.open("about:blank", "_blank");
    try {
      const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plano: escolhido, documento }) });
      const d = (await r.json().catch(() => ({}))) as { link?: string | null; erro?: string; campos?: Array<{ mensagem: string }> };
      if (!r.ok) throw new Error(d.campos?.[0]?.mensagem ?? d.erro ?? "Não foi possível gerar a cobrança.");
      if (d.link && aba) aba.location.href = d.link;
      else aba?.close();
      toast.success(d.link ? "Cobrança aberta em outra aba. Assim que o pagamento cair, o plano é liberado sozinho." : "Plano atualizado. A próxima cobrança já vem com o valor novo.");
      router.refresh();
    } catch (erro) {
      aba?.close();
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setCancelando(true);
    try {
      const r = await fetch("/api/assinatura", { method: "DELETE" });
      const d = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível cancelar.");
      toast.success("Assinatura cancelada. Você usa o sistema até o fim do período pago.");
      setConfirmarCancelamento(false);
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-5">
        {pedido && (
          <div className="flex items-start gap-3 rounded-2xl border border-brilho/30 bg-azul/10 p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-ciano" aria-hidden="true" />
            <p>
              <strong className="font-semibold">{pedido.texto}</strong> Escolha o plano abaixo para liberar agora.
            </p>
          </div>
        )}
        {!liberado && (
          <div className="flex items-start gap-3 rounded-2xl border border-perigo/30 bg-perigo/10 p-4 text-sm text-perigo">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>O acesso está pausado até o pagamento. Seus leads e o CRM continuam guardados — nada foi apagado.</p>
          </div>
        )}

        <section aria-labelledby="titulo-planos">
          <h2 id="titulo-planos" className="mb-3 font-display text-lg font-semibold">
            Escolha o plano
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {planos.map((p) => {
              const selecionado = escolhido === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEscolhido(p.id)}
                  aria-pressed={selecionado}
                  className={cn(
                    "relative flex cursor-pointer flex-col rounded-2xl border p-5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5",
                    selecionado ? "border-brilho/70 bg-azul/[0.09] shadow-[0_18px_40px_-24px_rgba(255,90,31,0.9)]" : "border-fio bg-placa hover:border-brilho/35",
                  )}
                >
                  {p.destaque && (
                    <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ff7a45] to-[#e8470f] px-2.5 py-0.5 text-[0.68rem] font-bold text-sobre-brasa">
                      <Sparkles className="size-3" aria-hidden="true" /> Mais escolhido
                    </span>
                  )}
                  <span className="flex items-center justify-between">
                    <span className="font-display text-base font-semibold">{p.nome}</span>
                    {conta.plano === p.id && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">Seu plano</span>}
                  </span>
                  <span className="mt-3 flex items-baseline gap-1">
                    <span className="num font-display text-3xl font-semibold tracking-tight">{formatarPreco(p.precoCentavos)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground">{p.descricao}</span>
                  <span className="mt-4 text-sm font-semibold">{p.limites.leads_mes?.toLocaleString("pt-BR") ?? "Leads ilimitados"} leads novos por mês</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="placa p-5">
          <h2 className="font-display text-base font-semibold">Pagamento</h2>
          {!titular ? (
            <p className="mt-2 text-sm text-muted-foreground">Só o titular da conta pode assinar ou trocar o plano.</p>
          ) : !cobrancaPronta ? (
            <p className="mt-2 text-sm text-muted-foreground">A cobrança online está sendo ligada. Enquanto isso, chame o suporte no WhatsApp para assinar.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="documento">CPF ou CNPJ (vai na nota da cobrança)</Label>
                <Input id="documento" inputMode="numeric" autoComplete="off" value={documento} onChange={(e) => setDocumento(mascararDocumento(e.target.value))} placeholder="000.000.000-00" className="mt-1.5 h-11" />
              </div>
              <Button type="button" onClick={pagar} disabled={enviando || mesmoPlanoPago || documento.replace(/\D/g, "").length < 11} className="h-11 cursor-pointer sm:min-w-56">
                {enviando ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
                {mesmoPlanoPago ? "Este já é o seu plano" : conta.temAssinatura ? `Mudar para ${planos.find((p) => p.id === escolhido)?.nome}` : "Pagar com Pix, boleto ou cartão"}
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Pagamento processado pelo Asaas. A renovação é mensal e você cancela quando quiser, sem multa.</p>
        </section>

        <section className="placa overflow-hidden">
          <h2 className="flex items-center gap-2 px-5 pt-4 font-display text-base font-semibold">
            <Receipt className="size-4 text-muted-foreground" aria-hidden="true" /> Pagamentos
          </h2>
          {faturas.length === 0 ? (
            <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-fio">
              {faturas.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="num w-24 text-muted-foreground">{data(f.vencimento ?? f.criado_em)}</span>
                  <span className="flex-1 font-medium">Plano {planos.find((p) => p.id === f.plano)?.nome ?? f.plano ?? "—"}</span>
                  <span className="num font-semibold">{formatarPreco(f.valor_centavos)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.72rem] font-semibold", f.status === "paga" ? "bg-sucesso/15 text-sucesso" : f.status === "atrasada" ? "bg-perigo/15 text-perigo" : "bg-white/10 text-muted-foreground")}>
                    {STATUS_FATURA[f.status]}
                  </span>
                  {f.link && (f.status === "pendente" || f.status === "atrasada") && (
                    <a href={f.link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-ciano underline underline-offset-2">
                      Pagar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="placa p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Plano {atual.nome}</h2>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold", status.tom)}>{status.rotulo}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {conta.status === "teste"
              ? conta.diasRestantes !== null && conta.diasRestantes > 0
                ? `Teste até ${data(conta.validaAte)} (${conta.diasRestantes} dia${conta.diasRestantes === 1 ? "" : "s"}).`
                : "O teste acabou."
              : conta.status === "cancelada"
                ? `Acesso até ${data(conta.validaAte)}.`
                : `Renova em ${data(conta.validaAte)}.`}
          </p>
          {aberta?.link && (
            <a href={aberta.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] text-sm font-bold text-sobre-brasa">
              Pagar cobrança em aberto <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
          <div className="mt-5 space-y-4">
            <Barra rotulo="Leads novos no mês" usado={uso.leads} limite={atual.limites.leads_mes} />
            {(atual.limites.ia_mes ?? 1) > 0 && <Barra rotulo="IA da Vynexa no mês" usado={uso.ia} limite={atual.limites.ia_mes} />}
          </div>
        </section>

        <section className="placa p-5">
          <h2 className="font-display text-base font-semibold">O que cada plano tem</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {COMPARATIVO.map((linha) => {
              const p = planos.find((x) => x.id === escolhido) ?? atual;
              const v = linha.valor(p);
              return (
                <li key={linha.rotulo} className="flex items-start gap-2.5">
                  {v === false ? <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-sucesso" aria-hidden="true" />}
                  <span className={cn(v === false && "text-muted-foreground/70")}>
                    {linha.rotulo}
                    {typeof v === "string" && <span className="text-muted-foreground"> · {v}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Mostrando o plano {planos.find((x) => x.id === escolhido)?.nome}.</p>
        </section>

        {titular && conta.temAssinatura && conta.status !== "cancelada" && (
          <section className="rounded-2xl border border-fio p-5 text-sm">
            {confirmarCancelamento ? (
              <div className="space-y-3">
                <p>Cancelar a renovação? Você continua usando até {data(conta.validaAte)}. Depois disso o acesso pausa, mas nada é apagado.</p>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" onClick={cancelar} disabled={cancelando} className="cursor-pointer">
                    {cancelando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />} Cancelar assinatura
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmarCancelamento(false)} className="cursor-pointer">
                    Manter
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmarCancelamento(true)} className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Cancelar assinatura
              </button>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
