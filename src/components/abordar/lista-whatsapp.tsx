"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, LoaderCircle, Mail, MessageCircle, Sparkles, Star, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CHAVE_ABORDAR, guardarParaCampanha } from "@/components/leads/barra-massa";
import { AnelScore } from "@/components/leads/score";
import type { ItemFila } from "@/db/abordar";
import { cn } from "@/lib/utils";

/**
 * Enviar pelo WhatsApp — as empresas escolhidas em Leads, todas à vista.
 *
 * Cada linha tem a mensagem (escrita pela IA, editável) e o próprio botão
 * "Abrir no WhatsApp": o operador escolhe quem e em que ordem. Abrir marca
 * a empresa como abordada; quem aperta "enviar" no WhatsApp é sempre ele.
 */

type Props = {
  itensIniciais: ItemFila[] | null;
  origem: { tipo: "busca" | "selecao"; rotulo: string; buscaId: string | null };
  remetente: { responsavel: string; empresa: string };
};

type Mensagem = { texto: string; status: "pronta" | "escrevendo" | "simples" };

async function acaoLead(leadId: string, corpo: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/leads/${leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
}

function mensagemSimples(item: ItemFila, r: Props["remetente"]): string {
  // Só o que sabemos com certeza: o nome da empresa e quem escreve.
  return `Olá! Tudo bem? Sou ${r.responsavel}, da ${r.empresa}. Encontrei a ${item.nome} no Google e tenho uma ideia rápida para vocês receberem mais clientes pela internet. Posso te mostrar?`;
}

export function ListaWhatsapp({ itensIniciais, origem, remetente }: Props) {
  const router = useRouter();
  const [itens, setItens] = useState<ItemFila[] | null>(itensIniciais);
  const [mensagens, setMensagens] = useState<Record<string, Mensagem>>({});
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set());
  const [escrevendoTodas, setEscrevendoTodas] = useState(false);
  const escrevendo = useRef(new Set<string>());

  // Seleção feita em Leads: os ids chegam pelo sessionStorage.
  useEffect(() => {
    if (origem.tipo !== "selecao") return;
    let cancelado = false;
    const t = setTimeout(async () => {
      let ids: string[] = [];
      try {
        ids = (JSON.parse(sessionStorage.getItem(CHAVE_ABORDAR) ?? "[]") as unknown[]).filter((x): x is string => typeof x === "string");
      } catch {
        ids = [];
      }
      if (ids.length === 0) {
        if (!cancelado) setItens([]);
        return;
      }
      const r = await fetch("/api/abordar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: ids }) });
      const d = (await r.json().catch(() => ({}))) as { itens?: ItemFila[] };
      if (!cancelado) setItens(d.itens ?? []);
    }, 0);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [origem.tipo]);

  const comWhats = useMemo(() => (itens ?? []).filter((i) => i.numeroWhats), [itens]);
  const semWhatsComEmail = useMemo(() => (itens ?? []).filter((i) => !i.numeroWhats && i.email), [itens]);
  const pendentes = comWhats.filter((i) => !enviadas.has(i.leadId));

  // Mensagens já escritas antes (em outro momento) entram prontas.
  useEffect(() => {
    const t = setTimeout(() => {
      setMensagens((m) => {
        const novo = { ...m };
        for (const i of comWhats) if (!novo[i.leadId] && i.mensagem) novo[i.leadId] = { texto: i.mensagem, status: "pronta" };
        return novo;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [comWhats]);

  const escrever = useCallback(
    async (item: ItemFila) => {
      if (escrevendo.current.has(item.leadId)) return;
      escrevendo.current.add(item.leadId);
      setMensagens((m) => ({ ...m, [item.leadId]: { texto: m[item.leadId]?.texto ?? "", status: "escrevendo" } }));
      try {
        const r = await acaoLead(item.leadId, { acao: "abordagem", soWhatsapp: true });
        const d = (await r.json().catch(() => ({}))) as { versoes?: { whatsapp?: string } };
        if (!r.ok || !d.versoes?.whatsapp) throw new Error();
        setMensagens((m) => ({ ...m, [item.leadId]: { texto: d.versoes!.whatsapp!, status: "pronta" } }));
      } catch {
        setMensagens((m) => ({ ...m, [item.leadId]: { texto: m[item.leadId]?.texto || mensagemSimples(item, remetente), status: "simples" } }));
      } finally {
        escrevendo.current.delete(item.leadId);
      }
    },
    [remetente],
  );

  // As três primeiras sem mensagem já começam a ser escritas.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const i of comWhats.filter((x) => !x.mensagem).slice(0, 3)) void escrever(i);
    }, 0);
    return () => clearTimeout(t);
  }, [comWhats, escrever]);

  async function escreverTodas() {
    setEscrevendoTodas(true);
    const faltam = pendentes.filter((i) => mensagens[i.leadId]?.status !== "pronta");
    // Duas por vez: rápido sem estourar o limite da IA.
    for (let k = 0; k < faltam.length; k += 2) await Promise.all(faltam.slice(k, k + 2).map((i) => escrever(i)));
    setEscrevendoTodas(false);
    toast.success("Mensagens escritas. Revise e abra cada uma no WhatsApp.");
  }

  function abrir(item: ItemFila) {
    if (!item.numeroWhats) return;
    const texto = mensagens[item.leadId]?.texto?.trim() || mensagemSimples(item, remetente);
    window.open(`https://wa.me/${item.numeroWhats}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    void acaoLead(item.leadId, { acao: "contato", tipo: "whatsapp_aberto" });
    setEnviadas((e) => new Set(e).add(item.leadId));
  }

  function remover(item: ItemFila) {
    setItens((lista) => (lista ?? []).filter((i) => i.leadId !== item.leadId));
  }

  function emailParaOsSemWhats() {
    guardarParaCampanha(
      semWhatsComEmail.map((i) => i.leadId),
      "whatsapp",
    );
    router.push("/campanhas/nova");
  }

  if (itens === null) {
    return (
      <div className="placa flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Carregando as empresas escolhidas…
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="placa flex flex-col items-center px-6 py-14 text-center">
        <span className="pastilha mb-3 size-12">
          <Users className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold">Escolha as empresas primeiro</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Em Leads, marque as empresas que quer abordar e toque em <b className="text-foreground">WhatsApp</b> na barra de baixo. Empresas já contatadas ou marcadas como “não contatar” ficam de fora.
        </p>
        <Link href="/leads?situacao=nao_abordados" className="mt-5 inline-flex h-10 items-center rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
          Ir para Leads
        </Link>
      </div>
    );
  }

  const feitas = comWhats.length - pendentes.length;

  return (
    <div className="space-y-4">
      {/* Resumo e ações da lista */}
      <div className="placa flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            <span className="num">{feitas}</span> de <span className="num">{comWhats.length}</span> abertas no WhatsApp
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-[#1fa855]" initial={{ width: 0 }} animate={{ width: `${comWhats.length ? (feitas / comWhats.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void escreverTodas()}
            disabled={escrevendoTodas || pendentes.every((i) => mensagens[i.leadId]?.status === "pronta")}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-fio px-3.5 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {escrevendoTodas ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4 text-ciano" />} Escrever todas com IA
          </button>
          <button
            type="button"
            onClick={() => pendentes[0] && abrir(pendentes[0])}
            disabled={pendentes.length === 0}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white hover:bg-[#25c062] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="size-4" /> Abrir a próxima
          </button>
        </div>
      </div>

      {semWhatsComEmail.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-brilho/30 bg-azul/[0.07] p-3 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-muted-foreground">
            <b className="text-foreground">{semWhatsComEmail.length}</b> das escolhidas não têm WhatsApp, mas têm e-mail.
          </p>
          <button type="button" onClick={emailParaOsSemWhats} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho">
            <Mail className="size-4" /> Enviar e-mail para elas
          </button>
        </div>
      )}

      {comWhats.length === 0 ? (
        <div className="placa px-6 py-10 text-center text-sm text-muted-foreground">Nenhuma das empresas escolhidas tem WhatsApp.</div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {comWhats.map((item) => {
              const m = mensagens[item.leadId];
              const feita = enviadas.has(item.leadId);
              return (
                <motion.li
                  key={item.leadId}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("placa overflow-hidden p-4", feita && "opacity-60")}
                >
                  <div className="flex items-start gap-3">
                    <AnelScore score={item.score} tamanho={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <Link href={`/leads/${item.leadId}`} target="_blank" className="min-w-0 flex-1 font-semibold leading-tight hover:text-ciano">
                          {item.nome}
                          <ExternalLink className="ml-1 inline size-3 opacity-50" aria-hidden="true" />
                        </Link>
                        {!feita && (
                          <button type="button" onClick={() => remover(item)} aria-label={`Tirar ${item.nome} da lista`} title="Tirar da lista" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground">
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[item.categoria, [item.cidade, item.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                        {item.avaliacaoNota !== null && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5">
                            <Star className="size-3 fill-current text-aviso" /> {item.avaliacaoNota.toLocaleString("pt-BR")} ({item.avaliacaoQtd ?? 0})
                          </span>
                        )}
                        {item.motivos[0] && <span className="ml-1.5">· {item.motivos[0]}</span>}
                      </p>
                    </div>
                  </div>

                  {feita ? (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-sucesso">
                      <Check className="size-4" /> Aberta no WhatsApp — marcada como abordada no CRM.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-stretch">
                      <div className="min-w-0 flex-1">
                        {m?.status === "escrevendo" && !m.texto ? (
                          <div className="flex h-[5.5rem] items-center justify-center gap-2 rounded-xl border border-fio bg-white/[0.02] text-sm text-muted-foreground">
                            <Sparkles className="size-4 animate-pulse text-ciano" /> A IA está escrevendo…
                          </div>
                        ) : m ? (
                          <textarea
                            value={m.texto}
                            onChange={(e) => setMensagens((x) => ({ ...x, [item.leadId]: { texto: e.target.value, status: x[item.leadId]?.status ?? "pronta" } }))}
                            rows={3}
                            aria-label={`Mensagem para ${item.nome}`}
                            className="w-full resize-y rounded-xl border border-fio bg-white/[0.03] p-3 text-sm leading-relaxed outline-none focus:border-brilho/60"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => void escrever(item)}
                            className="flex h-[5.5rem] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-fio text-sm text-muted-foreground hover:border-brilho/40 hover:text-foreground"
                          >
                            <Sparkles className="size-4 text-ciano" /> Escrever mensagem com IA
                          </button>
                        )}
                        {m?.status === "simples" && <p className="mt-1 text-xs text-aviso">A IA não respondeu agora; deixei uma mensagem simples, sem dados inventados. Edite se quiser.</p>}
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => abrir(item)}
                        disabled={m?.status === "escrevendo" && !m.texto}
                        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white hover:bg-[#25c062] disabled:cursor-wait disabled:opacity-60 md:h-auto md:w-44"
                      >
                        <MessageCircle className="size-4" /> Abrir no WhatsApp
                      </motion.button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <p className="pb-4 text-center text-xs text-muted-foreground">
        O WhatsApp abre com a mensagem pronta; quem aperta enviar é você. Origem: {origem.rotulo}.
      </p>
    </div>
  );
}
