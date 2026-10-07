"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Check,
  ChevronDown,
  LoaderCircle,
  Megaphone,
  PhoneCall,
  Reply,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { guardarParaCampanha } from "@/components/leads/barra-massa";
import { SeloEtapa } from "@/components/leads/presenca";
import type { EtapaLead } from "@/db/tipos";
import { cn } from "@/lib/utils";
import { DESCRICAO_ETAPA, ETAPAS, ROTULO_ETAPA } from "@/services/crm";

import { acaoLead } from "./acao";

/** Seletor de etapa do pipeline, com a mudança animada. */
export function SeletorEtapa({ leadId, etapa }: { leadId: string; etapa: EtapaLead }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  // Valor otimista enquanto o servidor confirma; depois, vale a prop.
  const [otimista, setOtimista] = useState<{ base: EtapaLead; valor: EtapaLead } | null>(null);
  const atual = otimista && otimista.base === etapa ? otimista.valor : etapa;
  const setAtual = (valor: EtapaLead) => setOtimista({ base: etapa, valor });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function mover(nova: EtapaLead) {
    setAberto(false);
    if (nova === atual) return;
    let motivo: string | undefined;
    if (nova === "perdido") {
      motivo = window.prompt("Por que o lead foi perdido? (opcional)") ?? undefined;
    }
    const anterior = atual;
    setAtual(nova);
    const r = await acaoLead(leadId, { acao: "etapa", etapa: nova, motivo });
    if (!r) setAtual(anterior);
    else {
      toast.success(`Movido para ${ROTULO_ETAPA[nova]}.`);
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-label="Mover no pipeline" className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-fio bg-placa pl-2 pr-2.5 hover:border-brilho/40">
        <AnimatePresence mode="wait">
          <motion.span key={atual} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
            <SeloEtapa etapa={atual} />
          </motion.span>
        </AnimatePresence>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-fio bg-popover p-1.5 shadow-2xl"
          >
            {ETAPAS.map((e) => (
              <li key={e}>
                <button type="button" onClick={() => mover(e)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white/5">
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{ROTULO_ETAPA[e]}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">{DESCRICAO_ETAPA[e]}</span>
                  </span>
                  {e === atual && <Check className="size-4 text-ciano" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

const botao = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm transition-colors hover:border-brilho/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A fileira de ações do perfil. */
export function AcoesLead({ leadId, naoContatar, iaConfigurada, analisado }: { leadId: string; naoContatar: boolean; iaConfigurada: boolean; analisado: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function executar(chave: string, corpo: Record<string, unknown>, sucesso: string) {
    setOcupado(chave);
    const r = await acaoLead(leadId, corpo);
    setOcupado(null);
    if (r) {
      toast.success(sucesso);
      router.refresh();
    }
    return r;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado !== null || !iaConfigurada} title={iaConfigurada ? undefined : "Configure a IA em Configurações"} onClick={() => executar("analisar", { acao: "analisar" }, "Análise concluída.")} className={cn(botao, "border-brilho/40 bg-azul/15 text-[#c4d3ff]")}>
          {ocupado === "analisar" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4 text-ciano" />}
          {analisado ? "Analisar de novo" : "Analisar oportunidade com IA"}
        </button>
        <button
          type="button"
          onClick={() => {
            guardarParaCampanha([leadId], `lead:${leadId}`);
            router.push("/campanhas/nova");
          }}
          className={botao}
        >
          <Megaphone className="size-4" /> Adicionar à campanha
        </button>
        <button type="button" onClick={() => setNota((n) => (n === null ? "" : null))} className={botao}>
          <StickyNote className="size-4" /> Adicionar nota
        </button>
        <button type="button" disabled={ocupado !== null || naoContatar} onClick={() => executar("contato", { acao: "contato", tipo: "contato_registrado" }, "Contato registrado.")} className={botao}>
          {ocupado === "contato" ? <LoaderCircle className="size-4 animate-spin" /> : <PhoneCall className="size-4" />} Marcar contato
        </button>
        <button type="button" disabled={ocupado !== null} onClick={() => executar("respondeu", { acao: "respondeu" }, "Resposta registrada. Follow-ups pendentes foram cancelados.")} className={botao}>
          {ocupado === "respondeu" ? <LoaderCircle className="size-4 animate-spin" /> : <Reply className="size-4" />} Lead respondeu
        </button>
        {!naoContatar && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => {
              const motivo = window.prompt("Motivo (ex.: pediu para não receber mensagens):");
              if (motivo && motivo.trim().length >= 2) void executar("nao", { acao: "nao_contatar", motivo }, "Marcado como NÃO CONTATAR. Contatos na lista de supressão.");
            }}
            className={cn(botao, "text-perigo hover:border-perigo/40")}
          >
            <Ban className="size-4" /> Não contatar
          </button>
        )}
      </div>
      <AnimatePresence>
        {nota !== null && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!nota.trim()) return;
              const r = await executar("nota", { acao: "nota", texto: nota }, "Nota adicionada ao histórico.");
              if (r) setNota(null);
            }}
          >
            <div className="flex gap-2">
              <input autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: falei com o dono, retornar na sexta" className="h-10 flex-1 rounded-xl border border-fio bg-placa px-3 text-sm outline-none focus:border-brilho/60" />
              <button type="submit" disabled={ocupado === "nota"} className="h-10 cursor-pointer rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
                Salvar
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Edição dos contatos (preenchimento manual, sempre marcado como "manual"). */
export function EditarContatos({ leadId, inicial }: { leadId: string; inicial: { telefone: string | null; email: string | null; instagram: string | null; website: string | null } }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-medium text-ciano hover:underline">
        Editar contatos
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        const r = await acaoLead(leadId, { acao: "contatos", ...v });
        setSalvando(false);
        if (r) {
          toast.success("Contatos atualizados. Score recalculado.");
          setAberto(false);
          router.refresh();
        }
      }}
    >
      {(["telefone", "email", "instagram", "website"] as const).map((k) => (
        <label key={k} className="block space-y-1">
          <span className="rotulo capitalize">{k}</span>
          <input value={v[k] ?? ""} onChange={(e) => setV((a) => ({ ...a, [k]: e.target.value || null }))} className="h-9 w-full rounded-lg border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60" />
        </label>
      ))}
      <p className="text-[0.7rem] text-muted-foreground">Preenchido à mão: fica marcado como origem &quot;manual&quot;.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="h-9 cursor-pointer rounded-lg bg-azul px-3 text-sm font-semibold text-white">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="h-9 cursor-pointer rounded-lg border border-fio px-3 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
