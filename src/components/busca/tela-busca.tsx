"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert, Crosshair, Map as IconeMapa, MapPin, Radar, RefreshCw, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BarraMassa, SeletorQuantidade, useSelecao } from "@/components/leads/barra-massa";
import { CartaoLead, EsqueletoCartao } from "@/components/leads/cartao-lead";
import { Contador } from "@/components/motion/contador";
import type { LeadListado } from "@/db/leads";
import { cn } from "@/lib/utils";
import type { FiltroSite } from "@/services/consulta-natural";

/**
 * O resultado de uma busca: o progresso de cada etapa, o resumo do que
 * foi achado e os cartões com seleção em massa. Usado pelo Radar.
 */

export type Formulario = {
  consultaNatural: string;
  termo: string;
  provedor: "google_places";
  pais: string; // "" = qualquer lugar
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  local: string;
  raioKm: number;
  site: FiltroSite;
  comWhatsapp: boolean;
  comEmail: boolean;
  avaliacoesMin: string;
  notaMin: string;
  scoreMin: number;
  maxRequisicoes: number;
};

export type Resumo = {
  total: number;
  novos: number;
  completados: number;
  semSite: number;
  soRedeSocial: number;
  comWhatsapp: number;
  comEmail: number;
  comInstagram: number;
  score80: number;
  excelentes: number;
  aviso: string | null;
};

export type EstadoBusca = {
  id: string;
  status: "pendente" | "em_andamento" | "concluida" | "erro";
  etapa: string | null;
  erro: string | null;
  resumo: Resumo | null;
  rotulo: string;
  /** Concluída, mas ainda visitando os sites atrás de e-mail. */
  procurandoEmails?: boolean;
};

const ETAPAS_PROGRESSO = ["Consultando Google Maps…", "Encontrando empresas…", "Analisando presença digital…", "Calculando oportunidade…", "Preparando resultados…"];

function indiceEtapa(etapa: string | null, status: string): number {
  if (status === "concluida") return ETAPAS_PROGRESSO.length;
  if (!etapa) return 0;
  if (etapa.startsWith("Consultando")) return 0;
  if (etapa.startsWith("Encontrando")) return 1;
  if (etapa.startsWith("Analisando")) return 2;
  if (etapa.startsWith("Calculando")) return 3;
  if (etapa.startsWith("Preparando")) return 4;
  return 0;
}


export const SUGESTOES = [
  "Barbearia", "Salão de beleza", "Clínica de estética", "Estética automotiva", "Lava-jato", "Oficina mecânica", "Imobiliária",
  "Corretor de imóveis", "Escritório de advocacia", "Dentista", "Clínica médica", "Academia", "Personal trainer", "Pet shop",
  "Veterinária", "Restaurante", "Hotel", "Pousada", "Loja de roupas", "Loja de móveis", "Fotógrafo", "Agência de marketing",
  "Construtora", "Arquitetura", "Contabilidade", "Consultoria", "Eletricista", "Encanador", "HVAC", "Roofing", "Contractor",
  "Plumber", "Dentist", "Realtor", "Real estate agency", "Auto detailing", "Car wash",
];

export const VAZIO: Formulario = {
  consultaNatural: "",
  termo: "",
  provedor: "google_places",
  pais: "BR",
  estado: "",
  cidade: "",
  bairro: "",
  cep: "",
  local: "",
  raioKm: 0,
  site: "todos",
  comWhatsapp: false,
  comEmail: false,
  avaliacoesMin: "",
  notaMin: "",
  scoreMin: 0,
  maxRequisicoes: 10,
};

export function ResultadoDaBusca({ estado, filtros, aoTentarDeNovo, aoLimpar }: { estado: EstadoBusca; filtros: Formulario; aoTentarDeNovo: () => void; aoLimpar: () => void }) {
  if (estado.status === "erro") {
    return (
      <div className="placa flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-perigo/12 text-perigo">
          <CircleAlert className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold">Não conseguimos concluir essa busca.</p>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">{estado.erro ?? "Verifique sua configuração de API e tente novamente."}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={aoTentarDeNovo} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-sobre-brasa hover:bg-brilho">
            <RefreshCw className="size-4" /> Tentar novamente
          </button>
          <Link href="/configuracoes?aba=integracoes" className="inline-flex h-10 items-center rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
            Ver configuração
          </Link>
        </div>
      </div>
    );
  }

  if (estado.status !== "concluida") return <Progresso estado={estado} />;
  return <Resultados estado={estado} filtros={filtros} aoLimpar={aoLimpar} />;
}

function Progresso({ estado }: { estado: EstadoBusca }) {
  const atual = indiceEtapa(estado.etapa, estado.status);
  const encontradas = /(\d+)$/.exec(estado.etapa ?? "")?.[1];
  return (
    <div className="space-y-5">
      <div className="heroi p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="relative flex size-20 shrink-0 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute inset-0 rounded-full border border-ciano/50" animate={{ scale: [0.5, 1.4], opacity: [0.8, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }} />
            ))}
            <motion.span className="absolute inset-2 rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(255,179,71,0.55), transparent 35%)" }} animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
            <Radar className="relative size-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/60">{estado.rotulo}</p>
            <AnimatePresence mode="wait">
              <motion.p key={estado.etapa ?? "fila"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="font-display text-2xl font-semibold text-white">
                {estado.etapa?.replace(/\s*\d+$/, "") ?? "Na fila…"}
              </motion.p>
            </AnimatePresence>
            {encontradas && <p className="mt-1 text-sm text-ciano num">{encontradas} empresas até agora</p>}
            {estado.erro && <p className="mt-2 text-xs text-aviso">{estado.erro}</p>}
          </div>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-5">
          {ETAPAS_PROGRESSO.map((e, i) => (
            <li key={e} className="space-y-1.5">
              <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                <motion.span className="block h-full bg-gradient-to-r from-brilho to-ciano" initial={{ width: 0 }} animate={{ width: i < atual ? "100%" : i === atual ? "55%" : "0%" }} transition={{ duration: 0.6 }} />
              </span>
              <span className={cn("flex items-center gap-1 text-[0.72rem]", i <= atual ? "text-white" : "text-white/40")}>
                {i < atual && <Check className="size-3 text-sucesso" />}
                {e.replace("…", "")}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <EsqueletoCartao key={i} />
        ))}
      </div>
    </div>
  );
}

function Resultados({ estado, filtros, aoLimpar }: { estado: EstadoBusca; filtros: Formulario; aoLimpar: () => void }) {
  const selecao = useSelecao();
  const r = estado.resumo;
  const [itens, setItens] = useState<LeadListado[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [soFiltrados, setSoFiltrados] = useState(true);
  const sentinela = useRef<HTMLDivElement>(null);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ busca: estado.id, ordem: "score" });
    if (soFiltrados) {
      if (filtros.site !== "todos") p.set("site", filtros.site);
      if (filtros.comWhatsapp) p.set("whatsapp", "1");
      if (filtros.comEmail) p.set("email", "1");
      if (filtros.scoreMin) p.set("scoreMin", String(filtros.scoreMin));
      if (filtros.avaliacoesMin) p.set("avaliacoesMin", filtros.avaliacoesMin);
      if (filtros.notaMin) p.set("notaMin", filtros.notaMin.replace(",", "."));
    }
    return p.toString();
  }, [estado.id, filtros, soFiltrados]);

  const carregar = useCallback(
    async (pag: number) => {
      setCarregando(true);
      try {
        const resp = await fetch(`/api/leads?${consulta}&pagina=${pag}&porPagina=24`);
        const d = (await resp.json()) as { itens: LeadListado[]; total: number };
        setItens((a) => (pag === 1 ? d.itens : [...a, ...d.itens]));
        setTotal(d.total);
        setPagina(pag);
      } catch {
        toast.error("Falha ao carregar os resultados.");
      } finally {
        setCarregando(false);
      }
    },
    [consulta],
  );

  useEffect(() => {
    const t = setTimeout(() => void carregar(1), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // Rolagem infinita: carrega a próxima página perto do fim.
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !carregando && itens.length < total) void carregar(pagina + 1);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [carregar, carregando, itens.length, total, pagina]);

  const temFiltro = filtros.site !== "todos" || filtros.comWhatsapp || filtros.comEmail || filtros.scoreMin > 0 || Boolean(filtros.avaliacoesMin) || Boolean(filtros.notaMin);

  const numeros = r
    ? [
        { v: r.total, t: "empresas" },
        { v: r.semSite, t: "sem site" },
        { v: r.comWhatsapp, t: "com WhatsApp" },
        { v: r.comEmail, t: estado.procurandoEmails ? "com e-mail (procurando…)" : "com e-mail" },
        { v: r.score80, t: "score > 80" },
        { v: r.excelentes, t: "excelentes oportunidades" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="heroi p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/60">Busca</p>
            <p className="font-display text-xl font-semibold text-white">{estado.rotulo}</p>
            {r && (
              <p className="mt-1 text-xs text-white/60">
                {r.novos} novas · {r.completados} já estavam na carteira (registro único, completado com os dados novos)
              </p>
            )}
          </div>
          <button type="button" onClick={aoLimpar} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs text-white/80 hover:bg-white/10">
            <X className="size-3.5" /> Nova busca
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {numeros.map((n, i) => (
            <motion.div key={n.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5">
              <Contador valor={n.v} className="font-display text-2xl font-semibold text-white" />
              <p className="text-[0.72rem] text-white/60">{n.t}</p>
            </motion.div>
          ))}
        </div>
        {r?.aviso && <p className="mt-3 text-xs text-aviso">{r.aviso}</p>}
        {r && (r.comWhatsapp > 0 || r.comEmail > 0) && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/15 bg-white/[0.07] p-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-white/80">
              <b className="text-white">{r.comWhatsapp}</b> com WhatsApp e <b className="text-white">{r.comEmail}</b> com e-mail. Escolha quem abordar e envie de uma vez
              {estado.procurandoEmails ? " (ainda procurando e-mails nos sites)" : ""}.
            </p>
            <Link href={`/leads?situacao=nao_abordados&busca=${estado.id}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#15120f] hover:bg-white/90">
              <Send className="size-4" /> Escolher quem abordar
            </Link>
          </div>
        )}
      </motion.div>

      <div className="flex flex-wrap items-center gap-2">
        <SeletorQuantidade consulta={consulta} total={total} aoSelecionar={selecao.definir} />
        <button
          type="button"
          onClick={() => selecao.definir(itens.filter((l) => (l.score_oportunidade ?? 0) > 80).map((l) => l.lead_id))}
          disabled={!itens.some((l) => (l.score_oportunidade ?? 0) > 80)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Crosshair className="size-4 text-ciano" /> Selecionar score &gt; 80
        </button>
        <Link href={`/mapa?busca=${estado.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
          <IconeMapa className="size-4" /> Ver no mapa
        </Link>
        <Link href={`/leads?busca=${estado.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
          <MapPin className="size-4" /> Abrir na lista
        </Link>
        {temFiltro && (
          <button type="button" onClick={() => setSoFiltrados((s) => !s)} className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {soFiltrados ? "Mostrar todas as empresas da busca" : "Aplicar os filtros da busca"}
          </button>
        )}
        <p className={cn("text-sm text-muted-foreground", !temFiltro && "ml-auto")}>
          <span className="font-semibold text-foreground num">{total.toLocaleString("pt-BR")}</span> {soFiltrados && temFiltro ? "com os filtros" : "no total"}
        </p>
      </div>

      {itens.length === 0 && !carregando ? (
        <div className="placa px-6 py-12 text-center">
          <p className="font-display font-semibold">Nenhuma empresa com esses filtros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A busca trouxe {r?.total ?? 0} empresas, mas nenhuma passa nos filtros. {temFiltro && "Mostre todas para ver o resultado completo."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((l) => (
            <CartaoLead key={l.lead_id} lead={l} selecionado={selecao.tem(l.lead_id)} aoSelecionar={selecao.alternar} />
          ))}
          {carregando && Array.from({ length: itens.length === 0 ? 6 : 3 }).map((_, i) => <EsqueletoCartao key={`e${i}`} />)}
        </div>
      )}
      <div ref={sentinela} />
      <div className="h-20" />
      <BarraMassa ids={selecao.ids} aoLimpar={selecao.limpar} origem={`busca:${estado.id}`} />
    </div>
  );
}
