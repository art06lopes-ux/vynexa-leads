"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Crosshair,
  LoaderCircle,
  Map as IconeMapa,
  MapPin,
  Radar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BarraMassa, SeletorQuantidade, useSelecao } from "@/components/leads/barra-massa";
import { CartaoLead, EsqueletoCartao } from "@/components/leads/cartao-lead";
import { Contador } from "@/components/motion/contador";
import type { LeadListado } from "@/db/leads";
import { CODIGOS_ISO, codigoDoPaisPorNome, nomePaisPt } from "@/lib/geo/mundo";
import { cn } from "@/lib/utils";
import { interpretarConsulta, type FiltroSite } from "@/services/consulta-natural";

/**
 * A tela de busca: pedido em linguagem natural ou formulário completo →
 * busca no provedor (Google Maps por padrão) com o progresso de cada
 * etapa → resumo do que foi achado → cartões com seleção em massa.
 */

type Provedores = Array<{ nome: "google_places" | "osm"; rotulo: string; disponivel: boolean }>;

type Formulario = {
  consultaNatural: string;
  termo: string;
  provedor: "google_places" | "osm";
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

type Resumo = {
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

type EstadoBusca = {
  id: string;
  status: "pendente" | "em_andamento" | "concluida" | "erro";
  etapa: string | null;
  erro: string | null;
  resumo: Resumo | null;
  rotulo: string;
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

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

const SUGESTOES = [
  "Barbearia", "Salão de beleza", "Clínica de estética", "Estética automotiva", "Lava-jato", "Oficina mecânica", "Imobiliária",
  "Corretor de imóveis", "Escritório de advocacia", "Dentista", "Clínica médica", "Academia", "Personal trainer", "Pet shop",
  "Veterinária", "Restaurante", "Hotel", "Pousada", "Loja de roupas", "Loja de móveis", "Fotógrafo", "Agência de marketing",
  "Construtora", "Arquitetura", "Contabilidade", "Consultoria", "Eletricista", "Encanador", "HVAC", "Roofing", "Contractor",
  "Plumber", "Dentist", "Realtor", "Real estate agency", "Auto detailing", "Car wash",
];

const VAZIO: Formulario = {
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

function Alternar({ ativo, aoMudar, rotulo }: { ativo: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={() => aoMudar(!ativo)}
      className={cn("flex h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 text-sm transition-colors", ativo ? "border-brilho/50 bg-azul/12" : "border-fio bg-placa hover:border-brilho/30")}
    >
      {rotulo}
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", ativo ? "bg-azul" : "bg-white/15")}>
        <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cn("absolute top-0.5 size-4 rounded-full bg-white", ativo ? "right-0.5" : "left-0.5")} />
      </span>
    </button>
  );
}

const campo = "h-10 w-full rounded-xl border border-fio bg-placa px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brilho/60";

export function TelaBusca({ provedores, buscaInicial }: { provedores: Provedores; buscaInicial: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const googleOk = provedores.find((p) => p.nome === "google_places")?.disponivel ?? false;
  const [f, setF] = useState<Formulario>({ ...VAZIO, provedor: googleOk ? "google_places" : "osm" });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<EstadoBusca | null>(null);
  const [cidades, setCidades] = useState<string[]>([]);
  const iniciou = useRef(false);

  const mudar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((a) => ({ ...a, [k]: v }));

  const paises = useMemo(
    () => CODIGOS_ISO.map((c) => ({ c, n: nomePaisPt(c) })).sort((a, b) => (a.c === "BR" ? -1 : b.c === "BR" ? 1 : a.n.localeCompare(b.n, "pt-BR"))),
    [],
  );

  // Municípios do IBGE quando o país é Brasil e há UF.
  useEffect(() => {
    if (f.pais !== "BR" || !UFS.includes(f.estado)) return;
    let cancelado = false;
    fetch(`/api/geo/municipios?uf=${f.estado}`)
      .then((r) => (r.ok ? r.json() : { municipios: [] }))
      .then((d: { municipios?: string[] }) => !cancelado && setCidades(d.municipios ?? []))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [f.pais, f.estado]);

  /** Preenche o formulário a partir da frase. */
  const aplicarFrase = useCallback(
    (texto: string): Formulario => {
      const c = interpretarConsulta(texto);
      const novo: Formulario = { ...f, consultaNatural: texto, termo: c.termo || f.termo, site: c.site, comWhatsapp: c.comWhatsapp, comEmail: c.comEmail };
      if (c.avaliacoesMin) novo.avaliacoesMin = String(c.avaliacoesMin);
      if (c.notaMin) novo.notaMin = String(c.notaMin);
      if (c.scoreMin) novo.scoreMin = c.scoreMin;
      novo.estado = "";
      novo.cidade = "";
      novo.local = "";
      if (c.local) {
        const soPais = codigoDoPaisPorNome(c.local);
        if (soPais) {
          novo.pais = soPais;
        } else {
          novo.pais = c.pais ?? "";
          const partes = c.local.split(/\s*,\s*/);
          const uf = partes.find((p) => UFS.includes(p.toUpperCase()));
          if (novo.pais === "BR" && uf) novo.estado = uf.toUpperCase();
          novo.cidade = partes[0] ?? "";
          novo.local = c.local;
        }
      } else if (!c.local && /qualquer lugar|anywhere|worldwide|todo o mundo/i.test(texto)) {
        novo.pais = "";
      }
      setF(novo);
      return novo;
    },
    [f],
  );

  const buscar = useCallback(
    async (form: Formulario) => {
      if (!form.termo.trim()) {
        toast.error("Diga o que procurar — por exemplo, \"Barbearia\".");
        return;
      }
      setEnviando(true);
      try {
        const r = await fetch("/api/buscas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultaNatural: form.consultaNatural || undefined,
            termo: form.termo,
            provedor: form.provedor,
            pais: form.pais || null,
            estado: form.estado || undefined,
            cidade: form.cidade || undefined,
            bairro: form.bairro || undefined,
            cep: form.cep || undefined,
            local: form.local || (!form.cidade && !form.estado && form.pais ? nomePaisPt(form.pais) : undefined),
            raioKm: form.raioKm > 0 ? form.raioKm : null,
            filtros: {
              site: form.site,
              comWhatsapp: form.comWhatsapp,
              comEmail: form.comEmail,
              avaliacoesMin: form.avaliacoesMin ? Number(form.avaliacoesMin) : null,
              notaMin: form.notaMin ? Number(form.notaMin.replace(",", ".")) : null,
              scoreMin: form.scoreMin || null,
            },
            maxRequisicoes: form.maxRequisicoes,
          }),
        });
        const d = (await r.json()) as { id?: string; erro?: string; codigo?: string };
        if (!r.ok || !d.id) {
          toast.error(d.erro ?? "Não conseguimos iniciar a busca.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => router.push("/configuracoes?aba=integracoes") } } : undefined);
          return;
        }
        const rotulo = form.consultaNatural || `${form.termo}${form.cidade ? ` em ${form.cidade}` : form.pais ? ` em ${nomePaisPt(form.pais)}` : ""}`;
        setEstado({ id: d.id, status: "pendente", etapa: "Na fila…", erro: null, resumo: null, rotulo });
        router.replace(`/buscar?busca=${d.id}`, { scroll: false });
      } catch {
        toast.error("Falha de rede ao iniciar a busca.");
      } finally {
        setEnviando(false);
      }
    },
    [router],
  );

  // Vindo do dashboard: /buscar?q=…&auto=1 já busca.
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    const t = setTimeout(() => {
      const q = params.get("q");
      if (q) {
        const form = aplicarFrase(q);
        if (params.get("auto") === "1") void buscar(form);
      } else if (buscaInicial) {
        setEstado({ id: buscaInicial, status: "em_andamento", etapa: null, erro: null, resumo: null, rotulo: "" });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [params, aplicarFrase, buscar, buscaInicial]);

  // Acompanha o andamento.
  useEffect(() => {
    if (!estado || estado.status === "concluida" || estado.status === "erro") return;
    let parar = false;
    const consultar = async () => {
      try {
        const r = await fetch(`/api/buscas/${estado.id}`, { cache: "no-store" });
        const d = (await r.json()) as { busca?: { status: EstadoBusca["status"]; etapa_atual: string | null; erro: string | null; consulta_natural: string | null; segmento: string; cidade: string | null }; resumo?: Resumo | null; erro?: string };
        if (parar || !d.busca) return;
        setEstado((a) =>
          a && a.id === estado.id
            ? {
                ...a,
                status: d.busca!.status,
                etapa: d.busca!.etapa_atual,
                erro: d.busca!.erro,
                resumo: d.resumo ?? null,
                rotulo: a.rotulo || d.busca!.consulta_natural || `${d.busca!.segmento}${d.busca!.cidade ? ` em ${d.busca!.cidade}` : ""}`,
              }
            : a,
        );
      } catch {
        /* tenta de novo */
      }
    };
    void consultar();
    const id = setInterval(consultar, 1500);
    return () => {
      parar = true;
      clearInterval(id);
    };
  }, [estado?.id, estado?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrosAtivos = [f.site !== "todos", f.comWhatsapp, f.comEmail, Boolean(f.avaliacoesMin), Boolean(f.notaMin), f.scoreMin > 0, f.raioKm > 0, Boolean(f.bairro), Boolean(f.cep)].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Pedido em linguagem natural */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(aplicarFrase(f.consultaNatural));
        }}
        className="flex items-center gap-2 rounded-2xl border border-brilho/35 bg-placa/90 p-2 shadow-[0_18px_50px_-24px_rgba(51,102,255,0.8)] focus-within:border-brilho/70"
      >
        <span className="pastilha ml-1 size-9 shrink-0">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <input
          value={f.consultaNatural}
          onChange={(e) => mudar("consultaNatural", e.target.value)}
          placeholder="Ex.: estética automotiva em Miami sem site com mais de 50 avaliações"
          aria-label="Busca em linguagem natural"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground/60"
        />
        <button type="button" onClick={() => f.consultaNatural.trim() && aplicarFrase(f.consultaNatural)} className="hidden h-11 cursor-pointer items-center rounded-xl px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground sm:inline-flex">
          Preencher filtros
        </button>
        <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={enviando || !f.consultaNatural.trim()} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50">
          {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} <span className="hidden sm:inline">Buscar</span>
        </motion.button>
      </form>

      {/* Formulário completo */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(f);
        }}
        className="placa p-4 sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-12">
          <label className="space-y-1.5 md:col-span-4">
            <span className="rotulo">Categoria</span>
            <input list="sugestoes-categoria" value={f.termo} onChange={(e) => mudar("termo", e.target.value)} placeholder="Qualquer categoria do Google Maps" className={campo} required />
            <datalist id="sugestoes-categoria">
              {SUGESTOES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1.5 md:col-span-3">
            <span className="rotulo">País</span>
            <select value={f.pais} onChange={(e) => setF((a) => ({ ...a, pais: e.target.value, estado: "", cidade: "" }))} className={cn(campo, "cursor-pointer")}>
              <option value="">Qualquer lugar</option>
              {paises.map((p) => (
                <option key={p.c} value={p.c}>
                  {p.n}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="rotulo">Estado / região</span>
            {f.pais === "BR" ? (
              <select value={f.estado} onChange={(e) => setF((a) => ({ ...a, estado: e.target.value, cidade: "" }))} className={cn(campo, "cursor-pointer")}>
                <option value="">Todos</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            ) : (
              <input value={f.estado} onChange={(e) => mudar("estado", e.target.value)} placeholder="California" className={campo} disabled={!f.pais} />
            )}
          </label>
          <label className="space-y-1.5 md:col-span-3">
            <span className="rotulo">Cidade</span>
            <input list="sugestoes-cidade" value={f.cidade} onChange={(e) => mudar("cidade", e.target.value)} placeholder={f.pais === "BR" ? "Manacapuru" : "Los Angeles"} className={campo} />
            <datalist id="sugestoes-cidade">
              {cidades.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-fio bg-placa p-1" role="radiogroup" aria-label="Fonte">
            {provedores.map((p) => (
              <button
                key={p.nome}
                type="button"
                role="radio"
                aria-checked={f.provedor === p.nome}
                onClick={() => mudar("provedor", p.nome)}
                className={cn("relative h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors", f.provedor === p.nome ? "text-white" : "text-muted-foreground hover:text-foreground")}
              >
                {f.provedor === p.nome && <motion.span layoutId="provedor-ativo" className="absolute inset-0 rounded-lg bg-azul" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative flex items-center gap-1.5">
                  {p.rotulo}
                  {!p.disponivel && <span className="rounded bg-aviso/20 px-1 text-[0.6rem] text-aviso">sem chave</span>}
                </span>
              </button>
            ))}
          </div>

          <div className="flex rounded-xl border border-fio bg-placa p-1" role="radiogroup" aria-label="Site">
            {(
              [
                ["todos", "Todos"],
                ["sem", "Sem site"],
                ["com", "Com site"],
                ["ruim", "Site fraco"],
              ] as const
            ).map(([v, r]) => (
              <button key={v} type="button" role="radio" aria-checked={f.site === v} onClick={() => mudar("site", v)} className={cn("relative h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold", f.site === v ? "text-white" : "text-muted-foreground hover:text-foreground")}>
                {f.site === v && <motion.span layoutId="site-ativo" className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative">{r}</span>
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setFiltrosAbertos((a) => !a)} aria-expanded={filtrosAbertos} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
            <SlidersHorizontal className="size-4" /> Mais filtros
            {filtrosAtivos > 0 && <span className="rounded-full bg-azul px-1.5 text-[0.7rem] font-bold text-white">{filtrosAtivos}</span>}
          </button>

          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={enviando} className="ml-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(51,102,255,0.9)] hover:bg-brilho disabled:opacity-60">
            {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {filtrosAbertos && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <div className="mt-4 grid gap-3 border-t border-fio pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1.5">
                  <span className="rotulo">Bairro</span>
                  <input value={f.bairro} onChange={(e) => mudar("bairro", e.target.value)} className={campo} placeholder="Centro" />
                </label>
                <label className="space-y-1.5">
                  <span className="rotulo">CEP / código postal</span>
                  <input value={f.cep} onChange={(e) => mudar("cep", e.target.value)} className={campo} placeholder="69400-000" />
                </label>
                <label className="space-y-1.5">
                  <span className="rotulo">Raio: {f.raioKm > 0 ? `${f.raioKm} km a partir do centro da cidade` : "área da cidade"}</span>
                  <input type="range" min={0} max={100} step={5} value={f.raioKm} onChange={(e) => mudar("raioKm", Number(e.target.value))} className="h-10 w-full cursor-pointer accent-[#3366ff]" />
                </label>
                <label className="space-y-1.5">
                  <span className="rotulo">Score mínimo: {f.scoreMin || "sem mínimo"}</span>
                  <input type="range" min={0} max={100} step={5} value={f.scoreMin} onChange={(e) => mudar("scoreMin", Number(e.target.value))} className="h-10 w-full cursor-pointer accent-[#3366ff]" />
                </label>
                <label className="space-y-1.5">
                  <span className="rotulo">Mínimo de avaliações</span>
                  <input inputMode="numeric" value={f.avaliacoesMin} onChange={(e) => mudar("avaliacoesMin", e.target.value.replace(/\D/g, ""))} className={campo} placeholder="50" />
                </label>
                <label className="space-y-1.5">
                  <span className="rotulo">Nota mínima no Google</span>
                  <input inputMode="decimal" value={f.notaMin} onChange={(e) => mudar("notaMin", e.target.value.replace(/[^\d.,]/g, ""))} className={campo} placeholder="4,5" />
                </label>
                <div className="space-y-1.5">
                  <span className="rotulo">Canais</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Alternar ativo={f.comWhatsapp} aoMudar={(v) => mudar("comWhatsapp", v)} rotulo="WhatsApp" />
                    <Alternar ativo={f.comEmail} aoMudar={(v) => mudar("comEmail", v)} rotulo="E-mail" />
                  </div>
                </div>
                {f.provedor === "google_places" && (
                  <label className="space-y-1.5">
                    <span className="rotulo">Teto de requisições ao Google: {f.maxRequisicoes}</span>
                    <input type="range" min={1} max={60} value={f.maxRequisicoes} onChange={(e) => mudar("maxRequisicoes", Number(e.target.value))} className="h-10 w-full cursor-pointer accent-[#3366ff]" />
                    <span className="block text-[0.7rem] text-muted-foreground">Cada requisição traz até 20 empresas e conta na cota da Places API.</span>
                  </label>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {estado ? (
        <ResultadoDaBusca estado={estado} filtros={f} aoTentarDeNovo={() => void buscar(f)} aoLimpar={() => { setEstado(null); router.replace("/buscar", { scroll: false }); }} />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="placa flex flex-col items-center px-6 py-16 text-center">
          <span className="relative mb-4 flex size-16 items-center justify-center">
            <motion.span className="absolute inset-0 rounded-full border border-brilho/40" animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }} />
            <span className="pastilha size-14 rounded-full">
              <Radar className="size-6" />
            </span>
          </span>
          <p className="font-display text-lg font-semibold">Nenhum lead encontrado ainda</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Faça uma busca por categoria e localização para começar. Funciona no mundo todo — Manacapuru, Lisboa ou San Diego.</p>
        </motion.div>
      )}
    </div>
  );
}

function ResultadoDaBusca({ estado, filtros, aoTentarDeNovo, aoLimpar }: { estado: EstadoBusca; filtros: Formulario; aoTentarDeNovo: () => void; aoLimpar: () => void }) {
  if (estado.status === "erro") {
    return (
      <div className="placa flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-perigo/12 text-perigo">
          <CircleAlert className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold">Não conseguimos concluir essa busca.</p>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">{estado.erro ?? "Verifique sua configuração de API e tente novamente."}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={aoTentarDeNovo} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
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
            <motion.span className="absolute inset-2 rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(111,211,255,0.55), transparent 35%)" }} animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
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
        { v: r.comInstagram, t: "com Instagram" },
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
