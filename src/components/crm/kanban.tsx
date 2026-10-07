"use client";

import { LayoutGroup, motion } from "framer-motion";
import { GripVertical, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
};

const COR: Record<EtapaLead, string> = {
  novo: "#8e9bc2",
  qualificado: "#4d7cff",
  abordado: "#6fd3ff",
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

  return (
    <LayoutGroup>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {ETAPAS.map((etapa) => {
          const lista = cartoes.filter((c) => c.etapa === etapa);
          const soma = lista.reduce((t, c) => t + c.vendido_centavos, 0);
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
                  {soma > 0 ? ` · ${formatarDinheiro(soma)}` : ""}
                </p>
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
                    className="group relative cursor-grab touch-pan-y rounded-xl border border-fio bg-[#0c173a] p-3 active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2.5">
                      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/leads/${c.lead_id}`}
                          onClick={(e) => arrastando.current && e.preventDefault()}
                          draggable={false}
                          className="line-clamp-2 text-sm font-semibold leading-snug hover:text-ciano"
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
                      <span className="ml-auto">{haQuantoTempo(c.etapa_em)}</span>
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
