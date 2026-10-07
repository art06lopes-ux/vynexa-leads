"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, LoaderCircle, Pause, Pencil, Play, RefreshCw, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { EnvioDaCampanha } from "@/db/campanhas";
import type { StatusCampanha } from "@/db/tipos";
import { cn } from "@/lib/utils";

import { COR_ENVIO, ROTULO_ENVIO } from "./rotulos";

async function acao(id: string, corpo: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch(`/api/campanhas/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { erro?: string; codigo?: string };
      toast.error(d.erro ?? "Não foi possível concluir.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => (location.href = "/configuracoes?aba=email") } } : undefined);
      return false;
    }
    return true;
  } catch {
    toast.error("Falha de rede.");
    return false;
  }
}

/** Atualiza a página sozinho enquanto há trabalho em andamento. */
export function AtualizacaoAutomatica({ ativo, intervalo = 4000 }: { ativo: boolean; intervalo?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), intervalo);
    return () => clearInterval(id);
  }, [ativo, intervalo, router]);
  return null;
}

export function ControleCampanha({ id, status, preparados, total, erros }: { id: string; status: StatusCampanha; preparados: number; total: number; erros: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState("");

  async function executar(chave: string, corpo: Record<string, unknown>, ok: string) {
    setOcupado(chave);
    const r = await acao(id, corpo);
    setOcupado(null);
    if (r) {
      toast.success(ok);
      router.refresh();
    }
  }

  const botao = "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "pronta" || status === "pausada") && (
        <>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            disabled={ocupado !== null || preparados === 0}
            onClick={() => {
              if (window.confirm(`Autorizar o envio de ${preparados} e-mail(s) agora, no ritmo configurado?`)) {
                void executar("autorizar", { acao: "autorizar", quando: null }, "Envio autorizado. A fila começou.");
              }
            }}
            className={cn(botao, "bg-azul text-white hover:bg-brilho")}
          >
            {ocupado === "autorizar" ? <LoaderCircle className="size-4 animate-spin" /> : status === "pausada" ? <Play className="size-4" /> : <Send className="size-4" />}
            {status === "pausada" ? "Retomar envio" : "Autorizar e enviar agora"}
          </motion.button>
          <button type="button" onClick={() => setAgendar((a) => !a)} className={cn(botao, "border border-fio hover:bg-white/5")}>
            <CalendarClock className="size-4" /> Agendar
          </button>
        </>
      )}
      {(status === "enviando" || status === "agendada") && (
        <button type="button" disabled={ocupado !== null} onClick={() => executar("pausar", { acao: "pausar" }, "Campanha pausada.")} className={cn(botao, "border border-aviso/40 text-aviso hover:bg-aviso/10")}>
          <Pause className="size-4" /> Pausar
        </button>
      )}
      {erros > 0 && ["pronta", "pausada", "preparando"].includes(status) && (
        <button type="button" disabled={ocupado !== null} onClick={() => executar("preparar", { acao: "preparar" }, "Gerando de novo os textos que falharam.")} className={cn(botao, "border border-fio hover:bg-white/5")}>
          {ocupado === "preparar" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Gerar de novo os {erros} com erro
        </button>
      )}
      {!["concluida", "cancelada"].includes(status) && (
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() => window.confirm("Cancelar a campanha? Os e-mails ainda não enviados não sairão.") && void executar("cancelar", { acao: "cancelar" }, "Campanha cancelada.")}
          className={cn(botao, "text-muted-foreground hover:text-perigo")}
        >
          <X className="size-4" /> Cancelar
        </button>
      )}
      <AnimatePresence>
        {agendar && (
          <motion.form
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new Date(quando);
              if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) {
                toast.error("Escolha uma data no futuro.");
                return;
              }
              const utc = d.toISOString().replace("T", " ").slice(0, 19);
              void executar("autorizar", { acao: "autorizar", quando: utc }, `Agendada para ${d.toLocaleString("pt-BR")}.`).then(() => setAgendar(false));
            }}
          >
            <input type="datetime-local" required value={quando} onChange={(e) => setQuando(e.target.value)} className="h-10 rounded-xl border border-fio bg-placa px-3 text-sm [color-scheme:dark]" />
            <button type="submit" className={cn(botao, "bg-azul text-white")}>
              Confirmar
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      {status === "preparando" && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin text-ciano" /> IA escrevendo: {preparados} de {total}
        </span>
      )}
    </div>
  );
}

/** Previews editáveis — o operador lê e corrige antes de autorizar. */
export function PreviewsEnvios({ campanhaId, envios, editavel }: { campanhaId: string; envios: EnvioDaCampanha[]; editavel: boolean }) {
  const router = useRouter();
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(envios.slice(0, 3).map((e) => e.id)));
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ assunto: "", corpo: "" });
  const [salvando, setSalvando] = useState(false);

  return (
    <ul className="space-y-2.5">
      {envios.map((e) => {
        const aberto = abertos.has(e.id);
        return (
          <li key={e.id} className="overflow-hidden rounded-xl border border-fio">
            <button
              type="button"
              onClick={() => setAbertos((a) => { const n = new Set(a); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
              aria-expanded={aberto}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {e.empresa}
                  {e.passo > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">follow-up {e.passo}</span>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{e.assunto ?? (e.erro ? e.erro : "Aguardando a IA…")}</span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", COR_ENVIO[e.status])}>{ROTULO_ENVIO[e.status]}</span>
            </button>
            <AnimatePresence initial={false}>
              {aberto && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  {editando === e.id ? (
                    <form
                      className="space-y-2 border-t border-fio p-4"
                      onSubmit={async (ev) => {
                        ev.preventDefault();
                        setSalvando(true);
                        const ok = await acao(campanhaId, { acao: "editar_envio", envioId: e.id, ...rascunho });
                        setSalvando(false);
                        if (ok) {
                          setEditando(null);
                          toast.success("E-mail atualizado.");
                          router.refresh();
                        }
                      }}
                    >
                      <input value={rascunho.assunto} onChange={(ev) => setRascunho((r) => ({ ...r, assunto: ev.target.value }))} className="h-9 w-full rounded-lg border border-fio bg-white/[0.03] px-3 text-sm" aria-label="Assunto" />
                      <textarea value={rascunho.corpo} onChange={(ev) => setRascunho((r) => ({ ...r, corpo: ev.target.value }))} rows={8} className="w-full rounded-lg border border-fio bg-white/[0.03] p-3 text-sm" aria-label="Corpo" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={salvando} className="h-9 cursor-pointer rounded-lg bg-azul px-3 text-sm font-semibold text-white">{salvando ? "Salvando…" : "Salvar"}</button>
                        <button type="button" onClick={() => setEditando(null)} className="h-9 cursor-pointer rounded-lg border border-fio px-3 text-sm">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <div className="border-t border-fio bg-[#f8fafc] text-[#111827]">
                      <div className="space-y-0.5 border-b border-[#e5e7eb] px-4 py-2.5 text-xs">
                        <p><span className="inline-block w-14 font-semibold uppercase text-[#6b7280]">Para</span> {e.destinatario ?? "—"}</p>
                        <p><span className="inline-block w-14 font-semibold uppercase text-[#6b7280]">Assunto</span> <b>{e.assunto ?? "—"}</b></p>
                      </div>
                      <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">{e.corpo ?? (e.erro ? `Sem texto: ${e.erro}` : "A IA ainda está escrevendo este e-mail.")}</p>
                      {editavel && !e.enviado_em && e.status !== "cancelado" && (
                        <div className="px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setRascunho({ assunto: e.assunto ?? "", corpo: e.corpo ?? "" });
                              setEditando(e.id);
                            }}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#d1d5db] px-3 text-xs font-semibold text-[#374151] hover:bg-white"
                          >
                            <Pencil className="size-3.5" /> Editar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
