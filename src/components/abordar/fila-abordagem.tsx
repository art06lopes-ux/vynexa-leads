"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, CheckCircle2, ExternalLink, LoaderCircle, Mail, MessageCircle, RefreshCw, SkipForward, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AnelScore } from "@/components/leads/score";
import type { ItemFila } from "@/db/abordar";
import { cn } from "@/lib/utils";

/**
 * Abordar em sequência.
 *
 * WhatsApp: uma empresa por vez, com a mensagem já escrita pela IA (e a
 * da próxima sendo escrita enquanto o operador lê esta). Um toque abre a
 * conversa no WhatsApp e a fila anda sozinha — quem aperta "enviar" lá
 * continua sendo o operador; nada sai automático.
 *
 * E-mail: as empresas com e-mail viram uma campanha num clique; a IA
 * escreve todos, e nada sai antes da autorização na tela da campanha.
 */

export const CHAVE_ABORDAR = "vynexa:leads-para-abordar";

type Props = {
  itensIniciais: ItemFila[] | null;
  origem: { tipo: "busca" | "selecao" | "todos"; rotulo: string; buscaId: string | null };
  remetente: { responsavel: string; empresa: string };
  email: { provedor: string; pronto: boolean; motivo: string | null };
};

type EstadoMensagem = { texto: string; status: "pronta" | "escrevendo" | "erro" };

async function acaoLead(leadId: string, corpo: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/leads/${leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
}

function mensagemSimples(item: ItemFila, r: Props["remetente"]): string {
  // Só fatos que temos: o nome da empresa e quem escreve. Nada de números.
  return `Olá! Tudo bem? Sou ${r.responsavel}, da ${r.empresa}. Encontrei a ${item.nome} no Google e tenho uma ideia rápida para vocês receberem mais clientes pela internet. Posso te mostrar?`;
}

export function FilaAbordagem({ itensIniciais, origem, remetente, email }: Props) {
  const router = useRouter();
  const [itens, setItens] = useState<ItemFila[] | null>(itensIniciais);
  const [indice, setIndice] = useState(0);
  const [feitos, setFeitos] = useState(0);
  const [mensagens, setMensagens] = useState<Record<string, EstadoMensagem>>({});
  const escrevendo = useRef(new Set<string>());
  const [incluirComWhats, setIncluirComWhats] = useState(false);
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [confirmarBloqueio, setConfirmarBloqueio] = useState(false);
  const [procurandoEmails, setProcurandoEmails] = useState(false);

  // Seleção feita na lista de leads: os ids vêm pelo sessionStorage.
  useEffect(() => {
    if (origem.tipo !== "selecao") return;
    let cancelado = false;
    const t = setTimeout(async () => {
      let ids: string[] = [];
      try {
        ids = (JSON.parse(sessionStorage.getItem(CHAVE_ABORDAR) ?? "[]") as string[]).filter((x) => typeof x === "string");
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

  // Busca recém-feita: os e-mails ainda estão sendo procurados nos sites.
  // Enquanto isso, atualiza a lista sozinho.
  useEffect(() => {
    if (origem.tipo !== "busca" || !origem.buscaId) return;
    let parar = false;
    const consultar = async () => {
      try {
        const r = await fetch(`/api/buscas/${origem.buscaId}`, { cache: "no-store" });
        const d = (await r.json()) as { procurandoEmails?: boolean };
        if (parar) return;
        setProcurandoEmails(Boolean(d.procurandoEmails));
        const f = await fetch("/api/abordar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buscaId: origem.buscaId }) });
        const novos = ((await f.json().catch(() => ({}))) as { itens?: ItemFila[] }).itens;
        // Só acrescenta e-mails novos; a ordem da fila do WhatsApp não muda
        // debaixo do operador.
        if (!parar && novos) {
          setItens((atual) => {
            if (!atual) return novos;
            const porId = new Map(novos.map((n) => [n.leadId, n]));
            return atual.map((a) => ({ ...a, email: porId.get(a.leadId)?.email ?? a.email }));
          });
        }
        if (d.procurandoEmails) setTimeout(consultar, 5000);
      } catch {
        /* a próxima visita à tela resolve */
      }
    };
    void consultar();
    return () => {
      parar = true;
    };
  }, [origem.tipo, origem.buscaId]);

  const filaWhats = useMemo(() => (itens ?? []).filter((i) => i.numeroWhats), [itens]);
  const comEmail = useMemo(() => (itens ?? []).filter((i) => i.email), [itens]);
  const soEmail = useMemo(() => comEmail.filter((i) => !i.numeroWhats), [comEmail]);
  const paraCampanha = incluirComWhats ? comEmail : soEmail;
  const atual = filaWhats[indice] ?? null;

  const escrever = useCallback(
    async (item: ItemFila, forcar = false) => {
      if (escrevendo.current.has(item.leadId)) return;
      if (!forcar && item.mensagem) {
        setMensagens((m) => (m[item.leadId] ? m : { ...m, [item.leadId]: { texto: item.mensagem!, status: "pronta" } }));
        return;
      }
      escrevendo.current.add(item.leadId);
      setMensagens((m) => ({ ...m, [item.leadId]: { texto: m[item.leadId]?.texto ?? "", status: "escrevendo" } }));
      try {
        const r = await acaoLead(item.leadId, { acao: "abordagem", soWhatsapp: true });
        const d = (await r.json().catch(() => ({}))) as { versoes?: { whatsapp?: string }; erro?: string };
        if (!r.ok || !d.versoes?.whatsapp) throw new Error(d.erro);
        setMensagens((m) => ({ ...m, [item.leadId]: { texto: d.versoes!.whatsapp!, status: "pronta" } }));
      } catch {
        setMensagens((m) => ({ ...m, [item.leadId]: { texto: m[item.leadId]?.texto || mensagemSimples(item, remetente), status: "erro" } }));
      } finally {
        escrevendo.current.delete(item.leadId);
      }
    },
    [remetente],
  );

  // A mensagem desta empresa e a da próxima, já adiantada.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const item of filaWhats.slice(indice, indice + 2)) if (!mensagens[item.leadId]) void escrever(item);
    }, 0);
    return () => clearTimeout(t);
  }, [indice, filaWhats, mensagens, escrever]);

  const avancar = useCallback(() => {
    setConfirmarBloqueio(false);
    setIndice((i) => i + 1);
  }, []);

  const abrirWhats = useCallback(() => {
    if (!atual?.numeroWhats) return;
    const texto = mensagens[atual.leadId]?.texto?.trim() || mensagemSimples(atual, remetente);
    window.open(`https://wa.me/${atual.numeroWhats}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    void acaoLead(atual.leadId, { acao: "contato", tipo: "whatsapp_aberto" });
    setFeitos((f) => f + 1);
    avancar();
  }, [atual, mensagens, remetente, avancar]);

  const bloquear = useCallback(async () => {
    if (!atual) return;
    if (!confirmarBloqueio) {
      setConfirmarBloqueio(true);
      return;
    }
    const r = await acaoLead(atual.leadId, { acao: "nao_contatar", motivo: "Marcado na fila de abordagem" });
    if (!r.ok) {
      toast.error("Não foi possível marcar.");
      return;
    }
    toast.success(`${atual.nome} não será mais contatada.`);
    avancar();
  }, [atual, confirmarBloqueio, avancar]);

  // Teclado no computador: Enter abre o WhatsApp, → pula.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        abrirWhats();
      } else if (e.key === "ArrowRight") {
        avancar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [abrirWhats, avancar]);

  async function criarCampanha() {
    if (paraCampanha.length === 0) return;
    setCriandoCampanha(true);
    try {
      const nome = `${origem.rotulo} — e-mail`.slice(0, 120);
      const r = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.length >= 3 ? nome : "Campanha de e-mail",
          leadIds: paraCampanha.map((i) => i.leadId),
          filtros: { origem: origem.tipo, buscaId: origem.buscaId },
          provedorEmail: email.provedor,
          ritmoPorHora: 20,
          limiteDiario: 80,
          followupDias: [3, 7],
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { id?: string; erro?: string };
      if (!r.ok || !d.id) throw new Error(d.erro ?? "Não foi possível criar a campanha.");
      toast.success("A IA está escrevendo os e-mails. Revise e autorize na próxima tela.");
      router.push(`/campanhas/${d.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar a campanha.");
    } finally {
      setCriandoCampanha(false);
    }
  }

  if (itens === null) {
    return (
      <div className="placa flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Montando a fila…
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="placa flex flex-col items-center px-6 py-14 text-center">
        <span className="pastilha mb-3 size-12">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold">Ninguém para abordar aqui</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Todas as empresas desta lista já foram contatadas, pediram para não receber contato ou não têm WhatsApp nem e-mail público.
        </p>
        <Link href="/buscar" className="mt-5 inline-flex h-10 items-center rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
          Fazer uma nova busca
        </Link>
      </div>
    );
  }

  const msg = atual ? mensagens[atual.leadId] : undefined;
  const progresso = filaWhats.length > 0 ? Math.min(indice, filaWhats.length) / filaWhats.length : 1;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* WhatsApp em sequência */}
      <section className="placa min-w-0 overflow-hidden lg:col-span-8" aria-labelledby="titulo-whats">
        <header className="flex flex-wrap items-center gap-3 border-b border-fio px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#1fa855]/15 text-[#3ddc84]">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-whats" className="font-display font-semibold">WhatsApp em sequência</h2>
            <p className="text-xs text-muted-foreground">
              {filaWhats.length === 0 ? "Nenhuma empresa desta lista tem WhatsApp." : `${Math.min(indice + 1, filaWhats.length)} de ${filaWhats.length} · ${feitos} aberta(s) agora`}
            </p>
          </div>
        </header>
        <div className="h-1 bg-white/5">
          <motion.div className="h-full bg-[#1fa855]" initial={{ width: 0 }} animate={{ width: `${progresso * 100}%` }} transition={{ duration: 0.35 }} />
        </div>

        {filaWhats.length > 0 && !atual && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-sucesso/15 text-sucesso">
              <CheckCircle2 className="size-6" />
            </span>
            <p className="font-display text-lg font-semibold">Fila concluída</p>
            <p className="mt-1 text-sm text-muted-foreground">Você abriu {feitos} conversa(s). Quem responder, marque como “Respondeu” no CRM.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/crm" className="inline-flex h-10 items-center rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
                Abrir o CRM
              </Link>
              <button type="button" onClick={() => setIndice(0)} className="h-10 cursor-pointer rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
                Rever a fila
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {atual && (
            <motion.div key={atual.leadId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-4 p-5">
              <div className="flex items-start gap-4">
                <AnelScore score={atual.score} tamanho={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold leading-tight">{atual.nome}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[atual.categoria, [atual.cidade, atual.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                    {atual.avaliacaoNota !== null && (
                      <span className="ml-2 inline-flex items-center gap-0.5">
                        <Star className="size-3 fill-current text-aviso" /> {atual.avaliacaoNota.toLocaleString("pt-BR")} ({atual.avaliacaoQtd ?? 0})
                      </span>
                    )}
                  </p>
                  {atual.motivos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {atual.motivos.map((m) => (
                        <span key={m} className="rounded-full border border-fio bg-white/[0.03] px-2 py-0.5 text-[0.72rem] text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link href={`/leads/${atual.leadId}`} target="_blank" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Abrir o lead em outra aba" title="Abrir o lead">
                  <ExternalLink className="size-4" />
                </Link>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="rotulo">Mensagem</span>
                  <button
                    type="button"
                    onClick={() => void escrever(atual, true)}
                    disabled={msg?.status === "escrevendo"}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className="size-3" /> Escrever outra
                  </button>
                </div>
                {msg?.status === "escrevendo" && !msg.texto ? (
                  <div className="flex h-32 items-center justify-center gap-2 rounded-xl border border-fio bg-white/[0.02] text-sm text-muted-foreground">
                    <Sparkles className="size-4 animate-pulse text-ciano" /> A IA está escrevendo para {atual.nome}…
                  </div>
                ) : (
                  <textarea
                    value={msg?.texto ?? ""}
                    onChange={(e) => setMensagens((m) => ({ ...m, [atual.leadId]: { texto: e.target.value, status: m[atual.leadId]?.status ?? "pronta" } }))}
                    rows={5}
                    className="w-full resize-y rounded-xl border border-fio bg-white/[0.03] p-3 text-sm leading-relaxed outline-none focus:border-brilho/60"
                  />
                )}
                {msg?.status === "erro" && <p className="text-xs text-aviso">A IA não respondeu agora; deixei uma mensagem simples, sem dados inventados. Edite à vontade ou tente “Escrever outra”.</p>}
              </div>

              <div className="flex flex-col gap-2 xl:flex-row">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={abrirWhats}
                  disabled={msg?.status === "escrevendo" && !msg.texto}
                  className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-5 text-base font-semibold text-white shadow-[0_10px_28px_-12px_rgba(31,168,85,0.9)] hover:bg-[#25c062] disabled:cursor-wait disabled:opacity-60"
                >
                  <MessageCircle className="size-5" /> Abrir no WhatsApp
                </motion.button>
                <div className="flex gap-2">
                  <button type="button" onClick={avancar} className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-fio px-4 text-sm hover:bg-white/5 xl:flex-none">
                    <SkipForward className="size-4" /> Pular
                  </button>
                  <button
                    type="button"
                    onClick={() => void bloquear()}
                    className={cn(
                      "inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 text-sm xl:flex-none",
                      confirmarBloqueio ? "border-perigo/50 bg-perigo/15 text-perigo" : "border-fio text-muted-foreground hover:bg-white/5",
                    )}
                  >
                    <Ban className="size-4" /> {confirmarBloqueio ? "Confirmar" : "Não contatar"}
                  </button>
                </div>
              </div>
              <p className="text-center text-[0.72rem] text-muted-foreground">Ao abrir o WhatsApp, a próxima empresa já aparece aqui. Quem aperta enviar lá é você.</p>
              <p className="hidden text-center text-[0.72rem] text-muted-foreground lg:block">
                Atalhos: <kbd className="rounded border border-fio px-1">Enter</kbd> abre o WhatsApp · <kbd className="rounded border border-fio px-1">→</kbd> pula.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* E-mail em massa */}
      <aside className="min-w-0 space-y-4 lg:col-span-4">
        <section className="placa p-5" aria-labelledby="titulo-email">
          <div className="flex items-center gap-3">
            <span className="pastilha size-9">
              <Mail className="size-5" />
            </span>
            <h2 id="titulo-email" className="font-display font-semibold">E-mail para todos de uma vez</h2>
          </div>
          <p className="mt-4 font-display text-4xl font-semibold num">{paraCampanha.length}</p>
          <p className="text-sm text-muted-foreground">
            empresa(s) recebem e-mail{!incluirComWhats && comEmail.length > soEmail.length ? " (as que não têm WhatsApp)" : ""}
          </p>
          {procurandoEmails && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ciano">
              <LoaderCircle className="size-3 animate-spin" /> Procurando e-mails nos sites das empresas…
            </p>
          )}
          {comEmail.length > soEmail.length && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={incluirComWhats} onChange={(e) => setIncluirComWhats(e.target.checked)} className="mt-0.5 size-4 accent-[#3366ff]" />
              Incluir também as {comEmail.length - soEmail.length} que têm WhatsApp (recebem pelos dois canais)
            </label>
          )}
          {!email.pronto && (
            <p className="mt-3 rounded-lg border border-aviso/30 bg-aviso/10 p-2.5 text-xs text-aviso">
              O envio de e-mail ainda não está pronto: {(email.motivo ?? "configure em Configurações → E-mail").replace(/\.\s*$/, "")}. Dá para criar e revisar agora; enviar, só depois de configurar.
            </p>
          )}
          <button
            type="button"
            onClick={() => void criarCampanha()}
            disabled={paraCampanha.length === 0 || criandoCampanha}
            className="mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50"
          >
            {criandoCampanha ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Escrever os e-mails com IA
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {paraCampanha.length === 0
              ? "Nenhuma empresa desta lista tem e-mail público — as sem site costumam ter só WhatsApp."
              : "A IA escreve um e-mail para cada empresa, com follow-up em 3 e 7 dias. Nada é enviado antes de você revisar e autorizar."}
          </p>
        </section>

        {filaWhats.length > indice + 1 && (
          <section className="placa p-4">
            <p className="rotulo mb-2">Próximas na fila</p>
            <ul className="space-y-1">
              {filaWhats.slice(indice + 1, indice + 6).map((i) => (
                <li key={i.leadId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{i.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground num">{i.score ?? "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
