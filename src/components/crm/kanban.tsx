"use client";

import { LayoutGroup, motion } from "framer-motion";
import { Flame, GripVertical, LayoutGrid, List, MessageCircle, Search, Star, TimerOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AnelScore } from "@/components/leads/score";
import type { EtapaLead } from "@/db/tipos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";
import { DESCRICAO_ETAPA, ETAPAS, haQuantoTempo, ROTULO_ETAPA } from "@/services/crm";

/**
 * Kanban do pipeline. Arrastar funciona com mouse e com toque (o arraste
 * é do Framer Motion, que usa pointer events); ao soltar, a coluna sob o
 * ponteiro recebe o cartão, que desliza com mola até o lugar novo. No
 * celular, o seletor no rodapé de cada cartão faz o mesmo sem arrastar.
 */

export type CartaoCrm = {
  lead_id: string;
  nome: string;
  categoria: string;
  cidade: string | null;
  score: number | null;
  etapa: EtapaLead;
  etapa_em: string | null;
  whatsapp: number | null;
  avaliacao_nota: number | null;
  vendido_centavos: number;
  previsto_centavos: number;
  prioridade: string | null;
};

type Filtro = "todas" | "paradas" | "prioritarias";

/** Sem movimento há tempo demais para a etapa: abordado 3 dias, as demais 7. */
function parado(c: CartaoCrm): boolean {
  const limite = c.etapa === "abordado" ? 3 : ["respondeu", "negociacao", "proposta"].includes(c.etapa) ? 7 : null;
  if (limite === null || !c.etapa_em) return false;
  const t = new Date(c.etapa_em.includes("T") ? c.etapa_em : `${c.etapa_em.replace(" ", "T")}Z`).getTime();
  return Date.now() - t >= limite * 86_400_000;
}

const COR: Record<EtapaLead, string> = {
  novo: "#a89c90",
  qualificado: "#ff7a45",
  abordado: "#ffb347",
  respondeu: "#f5b83d",
  negociacao: "#b48cff",
  proposta: "#ff9a5c",
  fechado: "#2bd47d",
  perdido: "#ff5c6c",
};

export function Kanban({ iniciais, totais }: { iniciais: CartaoCrm[]; totais: Record<EtapaLead, number> }) {
  const router = useRouter();
  const [cartoes, setCartoes] = useState(iniciais);
  const [contagem, setContagem] = useState(totais);
  const [sobre, setSobre] = useState<EtapaLead | null>(null);
  const arrastando = useRef(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [visao, setVisao] = useState<"quadro" | "lista">("quadro");
  const [q, setQ] = useState("");

  const termo = q.trim().toLowerCase();
  const visiveis = useMemo(
    () =>
      cartoes.filter(
        (c) =>
          (filtro === "todas" || (filtro === "paradas" ? parado(c) : c.prioridade === "alta")) &&
          (!termo || `${c.nome} ${c.categoria} ${c.cidade ?? ""}`.toLowerCase().includes(termo)),
      ),
    [cartoes, filtro, termo],
  );
  const qtdParadas = cartoes.filter(parado).length;
  const qtdPrioritarias = cartoes.filter((c) => c.prioridade === "alta").length;

  async function mover(leadId: string, para: EtapaLead) {
    const cartao = cartoes.find((c) => c.lead_id === leadId);
    if (!cartao || cartao.etapa === para) return;
    let motivo: string | undefined;
    if (para === "perdido") motivo = window.prompt("Por que o lead foi perdido? (opcional)") ?? undefined;
    const de = cartao.etapa;
    setCartoes((a) => a.map((c) => (c.lead_id === leadId ? { ...c, etapa: para, etapa_em: new Date().toISOString() } : c)));
    setContagem((t) => ({ ...t, [de]: Math.max(0, t[de] - 1), [para]: t[para] + 1 }));
    try {
      const r = await fetch(`/api/leads/${leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "etapa", etapa: para, motivo }) });
      if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
      toast.success(`${cartao.nome}: ${ROTULO_ETAPA[de]} → ${ROTULO_ETAPA[para]}`);
      if (para === "fechado") toast("Registre a venda no perfil do lead para atualizar a receita.", { action: { label: "Abrir", onClick: () => router.push(`/leads/${leadId}`) } });
    } catch (e) {
      setCartoes((a) => a.map((c) => (c.lead_id === leadId ? { ...c, etapa: de } : c)));
      setContagem((t) => ({ ...t, [de]: t[de] + 1, [para]: Math.max(0, t[para] - 1) }));
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível mover.");
    }
  }

  function colunaSob(x: number, y: number): EtapaLead | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const e = (el as HTMLElement).dataset?.etapa;
      if (e) return e as EtapaLead;
    }
    return null;
  }

  const barra = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar empresa" aria-label="Procurar no CRM" className="h-10 w-48 rounded-xl border border-fio bg-placa pl-9 pr-3 text-sm outline-none focus:border-brilho/60 sm:w-60" />
      </label>
      <div className="flex gap-1 rounded-xl border border-fio bg-placa p-1" role="radiogroup" aria-label="Filtro">
        {(
          [
            ["todas", "Todas", null, null],
            ["paradas", "Paradas", TimerOff, qtdParadas],
            ["prioritarias", "Prioritárias", Flame, qtdPrioritarias],
          ] as const
        ).map(([v, r, Icone, n]) => (
          <button key={v} type="button" role="radio" aria-checked={filtro === v} onClick={() => setFiltro(v)} title={v === "paradas" ? "Abordados há 3+ dias ou negociações há 7+ dias sem mudar de etapa" : undefined} className={cn("relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors", filtro === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}>
            {filtro === v && <motion.span layoutId="filtro-crm" className="absolute inset-0 rounded-lg bg-azul" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {Icone && <Icone className="relative size-3.5" />}
            <span className="relative">{r}</span>
            {n !== null && n > 0 && <span className="relative num opacity-75">{n}</span>}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-1 rounded-xl border border-fio bg-placa p-1" role="radiogroup" aria-label="Visão">
        {(
          [
            ["quadro", "Quadro", LayoutGrid],
            ["lista", "Lista", List],
          ] as const
        ).map(([v, r, Icone]) => (
          <button key={v} type="button" role="radio" aria-checked={visao === v} onClick={() => setVisao(v)} aria-label={r} className={cn("flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors", visao === v ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icone className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );

  if (visao === "lista") {
    return (
      <div>
        {barra}
        <div className="placa overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Empresa</th>
                <th className="px-3 py-3 font-semibold">Etapa</th>
                <th className="px-3 py-3 font-semibold">Na etapa há</th>
                <th className="px-5 py-3 text-right font-semibold">Previsto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fio">
              {visiveis.map((c) => (
                <tr key={c.lead_id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-2.5">
                    <Link href={`/leads/${c.lead_id}`} className="font-semibold hover:text-brilho">
                      {c.nome}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {c.categoria}
                      {c.cidade ? ` · ${c.cidade}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <select value={c.etapa} onChange={(e) => void mover(c.lead_id, e.target.value as EtapaLead)} aria-label={`Etapa de ${c.nome}`} className="h-8 cursor-pointer rounded-lg border border-fio bg-placa px-2 text-xs">
                      {ETAPAS.map((e) => (
                        <option key={e} value={e}>
                          {ROTULO_ETAPA[e]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cn("px-3 py-2.5 text-xs", parado(c) ? "font-semibold text-aviso" : "text-muted-foreground")}>{haQuantoTempo(c.etapa_em)}</td>
                  <td className="px-5 py-2.5 text-right">{c.previsto_centavos > 0 ? <span className="valor-sensivel font-semibold num">{formatarDinheiro(c.previsto_centavos)}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visiveis.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nada com esse filtro.</p>}
        </div>
      </div>
    );
  }

  return (
    <LayoutGroup>
      {barra}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {ETAPAS.map((etapa) => {
          const lista = visiveis.filter((c) => c.etapa === etapa);
          const soma = etapa === "fechado" ? lista.reduce((t, c) => t + c.vendido_centavos, 0) : lista.reduce((t, c) => t + c.previsto_centavos, 0);
          return (
            <section
              key={etapa}
              data-etapa={etapa}
              className={cn(
                "flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl border bg-placa/60 transition-colors",
                sobre === etapa ? "border-brilho/70 bg-azul/[0.08]" : "border-fio",
              )}
              aria-label={ROTULO_ETAPA[etapa]}
            >
              <header data-etapa={etapa} className="px-3.5 pb-2 pt-3">
                <div className="flex items-center gap-2" data-etapa={etapa}>
                  <span className="size-2 rounded-full" style={{ background: COR[etapa] }} aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">{ROTULO_ETAPA[etapa]}</h2>
                  <motion.span key={contagem[etapa]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="ml-auto rounded-full bg-white/[0.06] px-2 text-xs font-semibold num">
                    {contagem[etapa].toLocaleString("pt-BR")}
                  </motion.span>
                </div>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground" data-etapa={etapa}>
                  {DESCRICAO_ETAPA[etapa]}
                </p>
                {soma > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground" data-etapa={etapa}>
                    {etapa === "fechado" ? "Vendido" : "Previsto"} <span className="valor-sensivel font-semibold text-foreground num">{formatarDinheiro(soma)}</span>
                  </p>
                )}
              </header>
              <div data-etapa={etapa} className="flex min-h-40 flex-1 flex-col gap-2 px-2 pb-2">
                {lista.map((c) => (
                  <motion.article
                    key={c.lead_id}
                    layout
                    layoutId={c.lead_id}
                    drag
                    dragSnapToOrigin
                    dragElastic={0.15}
                    whileDrag={{ scale: 1.04, rotate: 1.5, zIndex: 50, boxShadow: "0 20px 50px -12px rgba(0,0,0,0.8)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    onDragStart={() => (arrastando.current = true)}
                    onDrag={(_, info) => setSobre(colunaSob(info.point.x - window.scrollX, info.point.y - window.scrollY))}
                    onDragEnd={(_, info) => {
                      const alvo = colunaSob(info.point.x - window.scrollX, info.point.y - window.scrollY);
                      setSobre(null);
                      setTimeout(() => (arrastando.current = false), 50);
                      if (alvo) void mover(c.lead_id, alvo);
                    }}
                    className={cn("group relative cursor-grab touch-pan-y rounded-xl border bg-placa-2 p-3 active:cursor-grabbing", parado(c) ? "border-aviso/40" : "border-fio")}
                  >
                    <div className="flex items-start gap-2.5">
                      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/leads/${c.lead_id}`}
                          onClick={(e) => arrastando.current && e.preventDefault()}
                          draggable={false}
                          className="line-clamp-2 text-sm font-semibold leading-snug hover:text-brilho"
                        >
                          {c.nome}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.categoria}
                          {c.cidade ? ` · ${c.cidade}` : ""}
                        </p>
                      </div>
                      <AnelScore score={c.score} tamanho={32} espessura={3} />
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                      {c.whatsapp === 1 && <MessageCircle className="size-3.5 text-sucesso" aria-label="Tem WhatsApp" />}
                      {c.avaliacao_nota !== null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="size-3 fill-aviso text-aviso" /> {c.avaliacao_nota.toFixed(1).replace(".", ",")}
                        </span>
                      )}
                      {c.prioridade === "alta" && <Flame className="size-3.5 text-brilho" aria-label="Prioridade alta" />}
                      {c.previsto_centavos > 0 && <span className="valor-sensivel font-semibold text-foreground/85 num">{formatarDinheiro(c.previsto_centavos)}</span>}
                      <span className={cn("ml-auto", parado(c) && "font-semibold text-aviso")}>{haQuantoTempo(c.etapa_em)}</span>
                    </div>
                    <select
                      value={c.etapa}
                      onChange={(e) => void mover(c.lead_id, e.target.value as EtapaLead)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`Mover ${c.nome}`}
                      className="mt-2 h-7 w-full cursor-pointer rounded-md border border-fio bg-transparent px-1.5 text-xs text-muted-foreground lg:hidden"
                    >
                      {ETAPAS.map((e) => (
                        <option key={e} value={e}>
                          {ROTULO_ETAPA[e]}
                        </option>
                      ))}
                    </select>
                  </motion.article>
                ))}
                {lista.length === 0 && (
                  <p data-etapa={etapa} className="m-1 rounded-xl border border-dashed border-fio px-3 py-6 text-center text-xs text-muted-foreground/70">
                    Arraste um lead para cá
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
