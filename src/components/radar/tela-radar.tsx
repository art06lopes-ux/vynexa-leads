"use client";

import { motion } from "framer-motion";
import { Crosshair, Link2, LoaderCircle, LocateFixed, MapPin, Radar, Star, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ResultadoDaBusca, SUGESTOES, VAZIO, type EstadoBusca, type Formulario, type Resumo } from "@/components/busca/tela-busca";
import { cn } from "@/lib/utils";
import { interpretarConsulta, type FiltroSite } from "@/services/consulta-natural";
import { pareceLinkMaps } from "@/services/link-maps";

import { CORES_AREA, type Area, type Foco } from "./territorio";

/**
 * O Radar: três passos e um mapa.
 *
 * 01 o alvo (segmento + onde), 02 a qualificação (o que conta como
 * oportunidade), 03 o território (até 3 áreas marcadas no mapa, cada uma
 * com seu raio). "Mapear oportunidades" dispara uma busca no Google Maps
 * por área — ou uma só para o lugar inteiro, se nenhuma área for marcada.
 */

const MapaTerritorio = dynamic(() => import("./mapa-territorio"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando o mapa…</div>,
});

const MAX_AREAS = 3;
const CHAVE_SALVO = "vynexa:radar";

type Lugar = { rotulo: string; lat: number; lng: number; bbox: { sul: number; oeste: number; norte: number; leste: number } };
type Execucao = { estado: EstadoBusca; area: number | null };

const campo = "h-11 w-full rounded-xl border border-fio bg-tinta/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brilho/60";

function Passo({ n, titulo, descricao, children }: { n: string; titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-fio pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{titulo}</legend>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-azul/15 font-display text-sm font-semibold text-brilho num" aria-hidden="true">
          {n}
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{titulo}</p>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="mt-3.5 space-y-3">{children}</div>
    </fieldset>
  );
}

function Segmentos<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: ReadonlyArray<readonly [T, string]>; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-fio bg-tinta/60 p-1" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => aoMudar(v)}
          className={cn("relative h-8 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors", valor === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}
        >
          {valor === v && <motion.span layoutId={`seg-${rotulo}`} className="absolute inset-0 rounded-lg bg-azul" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
          <span className="relative">{r}</span>
        </button>
      ))}
    </div>
  );
}

export function TelaRadar({
  googleOk,
  uso,
  tetoPadrao,
  buscasIniciais,
}: {
  googleOk: boolean;
  uso: { usadas: number; limite: number; restantes: number };
  tetoPadrao: number;
  buscasIniciais: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // 01 — alvo
  const [termo, setTermo] = useState("");
  const [onde, setOnde] = useState("");
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [link, setLink] = useState("");
  const [comLink, setComLink] = useState(false);
  // 02 — qualificação
  const [site, setSite] = useState<FiltroSite>("sem");
  const [nota, setNota] = useState<"" | "4" | "4.5">("");
  const [avaliacoes, setAvaliacoes] = useState<"" | "10" | "50" | "100">("");
  const [comWhatsapp, setComWhatsapp] = useState(false);
  // 03 — território
  const [areas, setAreas] = useState<Area[]>([]);
  const [raioPadrao, setRaioPadrao] = useState(3);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [teto, setTeto] = useState(Math.min(Math.max(tetoPadrao, 1), 20));
  // execução
  const [enviando, setEnviando] = useState(false);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [aba, setAba] = useState(0);
  const restaurou = useRef(false);
  const pronto = useRef(false);

  // Restaura o último território (só neste navegador) e os parâmetros da URL.
  useEffect(() => {
    if (restaurou.current) return;
    restaurou.current = true;
    const t = setTimeout(() => {
      try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_SALVO) ?? "null") as { termo?: string; onde?: string; areas?: Area[]; lugar?: Lugar | null } | null;
        if (salvo) {
          if (salvo.termo) setTermo(salvo.termo);
          if (salvo.onde) setOnde(salvo.onde);
          if (salvo.lugar) {
            setLugar(salvo.lugar);
            setFoco({ lat: salvo.lugar.lat, lng: salvo.lugar.lng, bbox: salvo.lugar.bbox });
          }
          if (Array.isArray(salvo.areas)) {
            setAreas(salvo.areas.slice(0, MAX_AREAS));
            if (salvo.areas[0] && !salvo.lugar) setFoco({ lat: salvo.areas[0].lat, lng: salvo.areas[0].lng, zoom: 12 });
          }
        }
      } catch {
        /* sem armazenamento: começa vazio */
      }
      const q = params.get("q");
      if (q && pareceLinkMaps(q)) {
        setComLink(true);
        setLink(q);
      } else if (q) {
        const c = interpretarConsulta(q);
        if (c.termo) setTermo(c.termo);
        if (c.local) setOnde(c.local);
        setSite(c.site);
      }
      if (buscasIniciais.length > 0) {
        setExecucoes(buscasIniciais.map((id, i) => ({ area: buscasIniciais.length > 1 ? i : null, estado: { id, status: "em_andamento", etapa: null, erro: null, resumo: null, rotulo: "" } })));
      }
      pronto.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [params, buscasIniciais]);

  // Guarda o território a cada mudança.
  useEffect(() => {
    if (!pronto.current) return;
    try {
      localStorage.setItem(CHAVE_SALVO, JSON.stringify({ termo, onde, areas, lugar }));
    } catch {
      /* armazenamento bloqueado: segue sem salvar */
    }
  }, [termo, onde, areas, lugar]);

  const irAoLocal = useCallback(async (): Promise<Lugar | null> => {
    const q = onde.trim();
    if (q.length < 2) {
      toast.error("Digite a cidade, o bairro ou o estado.");
      return null;
    }
    setLocalizando(true);
    try {
      const r = await fetch(`/api/geo/lugar?q=${encodeURIComponent(q)}`);
      const d = (await r.json()) as Partial<Lugar> & { erro?: string };
      if (!r.ok || d.lat === undefined || d.lng === undefined || !d.bbox) {
        toast.error(d.erro ?? "Não encontrei esse lugar.");
        return null;
      }
      const l: Lugar = { rotulo: d.rotulo ?? q, lat: d.lat, lng: d.lng, bbox: d.bbox };
      setLugar(l);
      setFoco({ lat: l.lat, lng: l.lng, bbox: l.bbox });
      return l;
    } catch {
      toast.error("Falha de rede ao localizar.");
      return null;
    } finally {
      setLocalizando(false);
    }
  }, [onde]);

  const adicionarArea = useCallback(
    (lat: number, lng: number) => setAreas((a) => (a.length >= MAX_AREAS ? a : [...a, { id: crypto.randomUUID(), lat, lng, raioKm: raioPadrao }])),
    [raioPadrao],
  );
  const moverArea = useCallback((id: string, lat: number, lng: number) => setAreas((a) => a.map((x) => (x.id === id ? { ...x, lat, lng } : x))), []);

  // Acompanha as buscas em andamento (todas de uma vez).
  const pendentes = execucoes.filter((e) => e.estado.status !== "erro" && (e.estado.status !== "concluida" || e.estado.procurandoEmails)).map((e) => e.estado.id).join(",");
  useEffect(() => {
    if (!pendentes) return;
    let parar = false;
    const ids = pendentes.split(",");
    const consultar = async () => {
      const respostas = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/buscas/${id}`, { cache: "no-store" });
            return [id, (await r.json()) as { busca?: { status: EstadoBusca["status"]; etapa_atual: string | null; erro: string | null; consulta_natural: string | null; segmento: string; cidade: string | null }; resumo?: Resumo | null; procurandoEmails?: boolean }] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      if (parar) return;
      setExecucoes((lista) =>
        lista.map((e) => {
          const d = respostas.find(([id]) => id === e.estado.id)?.[1];
          if (!d?.busca) return e;
          return {
            ...e,
            estado: {
              ...e.estado,
              status: d.busca.status,
              etapa: d.busca.etapa_atual,
              erro: d.busca.erro,
              resumo: d.resumo ?? null,
              procurandoEmails: Boolean(d.procurandoEmails),
              rotulo: e.estado.rotulo || d.busca.consulta_natural || `${d.busca.segmento}${d.busca.cidade ? ` em ${d.busca.cidade}` : ""}`,
            },
          };
        }),
      );
    };
    void consultar();
    const id = setInterval(consultar, 1800);
    return () => {
      parar = true;
      clearInterval(id);
    };
  }, [pendentes]);

  const filtros: Formulario = {
    ...VAZIO,
    termo,
    site,
    comWhatsapp,
    notaMin: nota,
    avaliacoesMin: avaliacoes,
    maxRequisicoes: teto,
  };

  const consumo = comLink ? teto : Math.max(areas.length, 1) * teto;

  async function criarBusca(corpo: Record<string, unknown>): Promise<string | null> {
    const r = await fetch("/api/buscas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const d = (await r.json()) as { id?: string; erro?: string; codigo?: string };
    if (!r.ok || !d.id) {
      toast.error(d.erro ?? "Não conseguimos iniciar a busca.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => router.push("/configuracoes?aba=integracoes") } } : undefined);
      return null;
    }
    return d.id;
  }

  async function mapear() {
    if (!googleOk) {
      toast.error("Ligue o Google Maps em Configurações → Integrações para usar o Radar.", { action: { label: "Configurar", onClick: () => router.push("/configuracoes?aba=integracoes") } });
      return;
    }
    if (comLink && !pareceLinkMaps(link)) {
      toast.error("Cole o endereço de uma pesquisa do Google Maps.");
      return;
    }
    if (!comLink && termo.trim().length < 2) {
      toast.error("Diga o segmento — por exemplo, \"Barbearia\".");
      return;
    }
    if (!comLink && areas.length === 0 && onde.trim().length < 2) {
      toast.error("Diga onde procurar ou marque uma área no mapa.");
      return;
    }
    if (consumo > uso.restantes) {
      toast.error(`Essa varredura pode usar até ${consumo} consultas e restam ${uso.restantes} no mês. Diminua as áreas ou o teto por área.`);
      return;
    }

    setEnviando(true);
    const qualificacao = {
      site,
      comWhatsapp,
      comEmail: false,
      avaliacoesMin: avaliacoes ? Number(avaliacoes) : null,
      notaMin: nota ? Number(nota) : null,
      scoreMin: null,
    };
    const novas: Execucao[] = [];
    try {
      if (comLink) {
        const id = await criarBusca({ termo: "", linkMaps: link.trim(), provedor: "google_places", filtros: qualificacao, maxRequisicoes: teto });
        if (id) novas.push({ area: null, estado: { id, status: "pendente", etapa: "Na fila…", erro: null, resumo: null, rotulo: "Pesquisa do Google Maps" } });
      } else if (areas.length > 0) {
        const pais = lugar && /Brasil|Brazil/.test(lugar.rotulo) ? "BR" : null;
        for (const [i, a] of areas.entries()) {
          const rotulo = `${termo.trim()} · P${i + 1} (${a.raioKm} km${onde.trim() ? `, ${onde.trim()}` : ""})`;
          const id = await criarBusca({
            termo: termo.trim(),
            consultaNatural: rotulo,
            provedor: "google_places",
            pais,
            local: onde.trim() || undefined,
            centro: { lat: a.lat, lng: a.lng },
            raioKm: a.raioKm,
            filtros: qualificacao,
            maxRequisicoes: teto,
          });
          if (id) novas.push({ area: i, estado: { id, status: "pendente", etapa: "Na fila…", erro: null, resumo: null, rotulo } });
        }
      } else {
        // Sem área: o lugar inteiro, com a mesma leitura de cidade/estado da busca clássica.
        const c = interpretarConsulta(`${termo.trim()} em ${onde.trim()}`);
        const corpo: Record<string, unknown> = { termo: termo.trim(), consultaNatural: `${termo.trim()} em ${onde.trim()}`, provedor: "google_places", filtros: qualificacao, maxRequisicoes: teto };
        if (c.local && (c.cidade || c.uf)) {
          corpo.pais = c.pais ?? "BR";
          if (c.uf) corpo.estado = c.uf;
          if (c.cidade) {
            corpo.cidade = c.cidade;
            corpo.local = c.local;
          }
        } else {
          corpo.local = onde.trim();
        }
        const id = await criarBusca(corpo);
        if (id) novas.push({ area: null, estado: { id, status: "pendente", etapa: "Na fila…", erro: null, resumo: null, rotulo: String(corpo.consultaNatural) } });
      }
    } catch {
      toast.error("Falha de rede ao iniciar a varredura.");
    } finally {
      setEnviando(false);
    }
    if (novas.length > 0) {
      setExecucoes(novas);
      setAba(0);
      router.replace(`/buscar?busca=${novas.map((n) => n.estado.id).join(",")}`, { scroll: false });
      requestAnimationFrame(() => document.getElementById("resultado-radar")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const atual = execucoes[aba] ?? execucoes[0];
  const fracaoUso = uso.limite > 0 ? Math.min(uso.usadas / uso.limite, 1) : 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Painel dos três passos */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mapear();
          }}
          className="placa flex flex-col gap-5 p-5 lg:col-span-5 xl:col-span-4"
        >
          <Passo n="01" titulo="Defina o alvo" descricao="O tipo de empresa e a região.">
            {comLink ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Link da pesquisa no Google Maps</span>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.google.com/maps/search/…" className={campo} autoFocus />
              </label>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Segmento</span>
                  <input list="radar-segmentos" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Barbearia, hamburgueria, clínica…" className={campo} />
                  <datalist id="radar-segmentos">
                    {SUGESTOES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <div className="space-y-1.5">
                  <label htmlFor="radar-onde" className="text-xs font-semibold text-muted-foreground">
                    Onde
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="radar-onde"
                      value={onde}
                      onChange={(e) => {
                        setOnde(e.target.value);
                        setLugar(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void irAoLocal();
                        }
                      }}
                      placeholder="Manacapuru, AM"
                      className={campo}
                    />
                    <button type="button" onClick={() => void irAoLocal()} disabled={localizando} className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-fio bg-placa-2 px-3 text-sm font-semibold hover:border-brilho/40 disabled:opacity-60">
                      {localizando ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4 text-brilho" />}
                      Ir ao local
                    </button>
                  </div>
                  {lugar && <p className="truncate text-[0.72rem] text-muted-foreground" title={lugar.rotulo}>{lugar.rotulo}</p>}
                </div>
              </>
            )}
            <button type="button" onClick={() => setComLink((v) => !v)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ciano hover:underline">
              <Link2 className="size-3.5" /> {comLink ? "Voltar para segmento e região" : "Tenho um link do Google Maps"}
            </button>
          </Passo>

          <Passo n="02" titulo="Qualificação" descricao="O que conta como oportunidade para a Vynexa.">
            <Segmentos
              rotulo="Site"
              valor={site}
              aoMudar={setSite}
              opcoes={[
                ["sem", "Sem site"],
                ["ruim", "Site fraco"],
                ["todos", "Todos"],
              ]}
            />
            {site === "sem" && (
              <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
                Inclui quem só tem Instagram ou WhatsApp. Em restaurante, hamburgueria e outros de alimentação, também quem só tem cardápio de plataforma
                (iFood, Brendi, Anota Aí, Goomer…).
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Star className="size-3" /> Nota mínima
                </span>
                <select value={nota} onChange={(e) => setNota(e.target.value as typeof nota)} className={cn(campo, "cursor-pointer")}>
                  <option value="">Qualquer</option>
                  <option value="4">4,0 ou mais</option>
                  <option value="4.5">4,5 ou mais</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Avaliações</span>
                <select value={avaliacoes} onChange={(e) => setAvaliacoes(e.target.value as typeof avaliacoes)} className={cn(campo, "cursor-pointer")}>
                  <option value="">Qualquer</option>
                  <option value="10">10 ou mais</option>
                  <option value="50">50 ou mais</option>
                  <option value="100">100 ou mais</option>
                </select>
              </label>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-fio bg-tinta/60 px-3.5 py-2.5 text-sm">
              Só quem tem WhatsApp
              <input type="checkbox" checked={comWhatsapp} onChange={(e) => setComWhatsapp(e.target.checked)} className="size-4 cursor-pointer accent-[#ff5a1f]" />
            </label>
          </Passo>

          {!comLink && (
            <Passo n="03" titulo="Território" descricao={`Clique no mapa para marcar até ${MAX_AREAS} áreas. Sem área, o Radar cobre o lugar inteiro.`}>
              {areas.length === 0 ? (
                <p className="flex items-center gap-2 rounded-xl border border-dashed border-fio px-3.5 py-3 text-xs text-muted-foreground">
                  <Crosshair className="size-4 shrink-0 text-brilho" /> Nenhuma área marcada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {areas.map((a, i) => (
                    <li key={a.id} className="rounded-xl border border-fio bg-tinta/60 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-sobre-brasa" style={{ background: CORES_AREA[i] }}>
                          P{i + 1}
                        </span>
                        <button type="button" onClick={() => setFoco({ lat: a.lat, lng: a.lng, zoom: 13 })} className="min-w-0 flex-1 cursor-pointer text-left text-xs text-muted-foreground hover:text-foreground">
                          <span className="block font-semibold text-foreground num">Raio de {a.raioKm} km</span>
                          <span className="num">
                            {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                          </span>
                        </button>
                        <button type="button" onClick={() => setAreas((x) => x.filter((y) => y.id !== a.id))} aria-label={`Remover área P${i + 1}`} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-perigo">
                          <X className="size-4" />
                        </button>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={a.raioKm}
                        onChange={(e) => setAreas((x) => x.map((y) => (y.id === a.id ? { ...y, raioKm: Number(e.target.value) } : y)))}
                        aria-label={`Raio da área P${i + 1} em km`}
                        className="mt-2 h-6 w-full cursor-pointer accent-[#ff5a1f]"
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  Raio da próxima área
                  <select value={raioPadrao} onChange={(e) => setRaioPadrao(Number(e.target.value))} className="h-8 cursor-pointer rounded-lg border border-fio bg-placa px-2 text-xs text-foreground">
                    {[1, 2, 3, 5, 10, 20].map((k) => (
                      <option key={k} value={k}>
                        {k} km
                      </option>
                    ))}
                  </select>
                </label>
                {areas.length > 0 && (
                  <button type="button" onClick={() => setAreas([])} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-muted-foreground hover:text-perigo">
                    <Trash2 className="size-3.5" /> Limpar
                  </button>
                )}
              </div>
            </Passo>
          )}

          {/* Créditos: a cota gratuita do Google, que é o que de fato limita. */}
          <div className="rounded-2xl border border-fio bg-tinta/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Consultas do mês</span>
              <span className={cn("num", uso.restantes < 30 ? "text-aviso" : "text-muted-foreground")}>
                restam <b className="text-foreground">{uso.restantes}</b> de {uso.limite}
              </span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/8">
              <span className="block h-full rounded-full bg-gradient-to-r from-ciano to-azul" style={{ width: `${(1 - fracaoUso) * 100}%` }} />
            </span>
            <label className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Teto por {comLink || areas.length === 0 ? "busca" : "área"}: <b className="text-foreground num">{teto}</b>
              </span>
              <input type="range" min={1} max={20} value={teto} onChange={(e) => setTeto(Number(e.target.value))} aria-label="Teto de consultas por área" className="h-6 w-32 cursor-pointer accent-[#ff5a1f]" />
            </label>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Esta varredura usa até <b className="text-foreground num">{consumo}</b> {consumo === 1 ? "consulta" : "consultas"} · cada uma traz até 20 empresas.
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={enviando}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-azul text-[0.95rem] font-semibold text-sobre-brasa shadow-[0_14px_34px_-12px_rgba(255,90,31,0.9)] hover:bg-brilho disabled:opacity-60"
          >
            {enviando ? <LoaderCircle className="size-5 animate-spin" /> : <Radar className="size-5" />}
            Mapear oportunidades
          </motion.button>
        </form>

        {/* O mapa */}
        <div className="placa relative h-[420px] overflow-hidden p-0 sm:h-[480px] lg:sticky lg:top-20 lg:col-span-7 lg:h-[calc(100dvh-7rem)] lg:self-start xl:col-span-8">
          <div className="absolute inset-0">
            <MapaTerritorio areas={areas} foco={foco} maxAreas={MAX_AREAS} aoAdicionar={adicionarArea} aoMover={moverArea} />
          </div>
          <div className="pointer-events-none absolute left-14 right-3 top-3 z-[500] flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full border border-fio bg-tinta/85 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <MapPin className="mr-1 inline size-3.5 text-brilho" />
              {areas.length}/{MAX_AREAS} áreas marcadas
            </span>
            {areas.length >= MAX_AREAS && <span className="rounded-full border border-fio bg-tinta/85 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">Limite de áreas — arraste os pinos para ajustar</span>}
          </div>
        </div>
      </div>

      {/* Resultado da varredura */}
      {atual && (
        <section id="resultado-radar" className="scroll-mt-24 space-y-4" aria-label="Resultado da varredura">
          {execucoes.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas da varredura">
              {execucoes.map((e, i) => (
                <button
                  key={e.estado.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === i}
                  onClick={() => setAba(i)}
                  className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors", aba === i ? "border-brilho/60 bg-azul/12" : "border-fio bg-placa hover:border-brilho/30")}
                >
                  <span className="size-2.5 rounded-full" style={{ background: CORES_AREA[(e.area ?? i) % CORES_AREA.length] }} aria-hidden="true" />
                  P{(e.area ?? i) + 1}
                  <span className="text-xs font-normal text-muted-foreground num">
                    {e.estado.status === "concluida" ? `${e.estado.resumo?.total ?? 0} empresas` : e.estado.status === "erro" ? "erro" : "mapeando…"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <ResultadoDaBusca
            key={atual.estado.id}
            estado={atual.estado}
            filtros={filtros}
            aoTentarDeNovo={() => void mapear()}
            aoLimpar={() => {
              setExecucoes([]);
              router.replace("/buscar", { scroll: false });
            }}
          />
        </section>
      )}
    </div>
  );
}
