"use client";

import "leaflet/dist/leaflet.css";

import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import { BoxSelect, Layers, LoaderCircle, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BarraMassa, useSelecao } from "@/components/leads/barra-massa";
import { corDoScore } from "@/components/leads/score";
import type { QualidadeSite, StatusSite } from "@/db/tipos";
import { cn } from "@/lib/utils";
import { ROTULO_PRESENCA, statusPresenca } from "@/services/qualidade-site";

/**
 * Mapa dos leads. Leaflet + base do OpenStreetMap escurecida, sem chave. Marcador colorido pelo score; clique abre o resumo do lead.
 * "Selecionar área": arraste um retângulo — os leads dentro dele entram
 * na seleção em massa, e dá para buscar novas empresas só ali.
 */

type Ponto = {
  id: string;
  nome: string;
  categoria: string;
  cidade: string | null;
  telefone: string | null;
  website: string | null;
  nota: number | null;
  avaliacoes: number | null;
  statusSite: StatusSite;
  qualidade: QualidadeSite | null;
  score: number | null;
  prioridade: string | null;
  solucao: string | null;
  lat: number;
  lng: number;
};

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function popup(p: Ponto): string {
  const presenca = ROTULO_PRESENCA[statusPresenca(p.statusSite, p.qualidade)];
  const nota = p.nota !== null ? `${p.nota.toFixed(1).replace(".", ",")}★ · ${p.avaliacoes ?? 0} avaliações` : "Sem avaliações na fonte";
  return `<div style="min-width:220px;font-size:13px;line-height:1.45">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
      <div><b style="font-size:14px">${escapar(p.nome)}</b><div style="color:#8e9bc2">${escapar(p.categoria)}${p.cidade ? ` · ${escapar(p.cidade)}` : ""}</div></div>
      <div style="font-family:var(--font-sora);font-size:18px;font-weight:600;color:${corDoScore(p.score)}">${p.score ?? "–"}</div>
    </div>
    <div style="margin-top:8px;color:#c9d3f2">${nota}</div>
    <div style="color:#c9d3f2">Telefone: ${p.telefone ? escapar(p.telefone) : "<span style='color:#8e9bc2'>não encontrado</span>"}</div>
    <div style="color:#c9d3f2">Site: ${p.website ? escapar(p.website.replace(/^https?:\/\//, "").slice(0, 40)) : "<span style='color:#8e9bc2'>não encontrado</span>"}</div>
    <div style="margin-top:6px"><span style="border:1px solid rgba(122,150,255,.3);border-radius:999px;padding:1px 8px;font-size:11px">${presenca}</span>
    ${p.prioridade ? `<span style="margin-left:4px;font-size:11px;color:#f5b83d">${p.prioridade === "alta" ? "Alta" : p.prioridade === "media" ? "Média" : "Baixa"} prioridade</span>` : ""}</div>
    <a href="/leads/${p.id}" style="display:block;margin-top:10px;text-align:center;background:#3366ff;color:#fff;border-radius:8px;padding:7px 0;font-weight:600;text-decoration:none">Abrir lead</a>
  </div>`;
}

const FILTROS = [
  { chave: "sem", rotulo: "Sem site", param: ["site", "sem"] },
  { chave: "ruim", rotulo: "Site fraco", param: ["site", "ruim"] },
  { chave: "whats", rotulo: "Com WhatsApp", param: ["whatsapp", "1"] },
  { chave: "s70", rotulo: "Score 70+", param: ["scoreMin", "70"] },
] as const;

export default function MapaLeads() {
  const router = useRouter();
  const params = useSearchParams();
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const retangulo = useRef<L.Rectangle | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ativos, setAtivos] = useState<Set<string>>(new Set());
  const [modoArea, setModoArea] = useState(false);
  const [area, setArea] = useState<L.LatLngBounds | null>(null);
  const [termo, setTermo] = useState("");
  const selecao = useSelecao();
  const busca = params.get("busca");

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!elemento.current || mapa.current) return;
    const m = L.map(elemento.current, { zoomControl: true, preferCanvas: true }).setView([-3.3, -60.6], 4);
    // Base padrão do OpenStreetMap (sem chave), escurecida por filtro CSS
    // (.mapa-escuro em globals.css). Uso leve, com atribuição — dentro da
    // política de tiles do OSM.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      className: "mapa-escuro",
    }).addTo(m);
    camada.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const p = new URLSearchParams();
    if (busca) p.set("busca", busca);
    for (const f of FILTROS) if (ativos.has(f.chave)) p.set(f.param[0], f.param[1]);
    try {
      const r = await fetch(`/api/mapa?${p.toString()}`);
      const d = (await r.json()) as { pontos?: Ponto[]; erro?: string };
      if (!r.ok) throw new Error(d.erro);
      setPontos(d.pontos ?? []);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível carregar o mapa.");
    } finally {
      setCarregando(false);
    }
  }, [ativos, busca]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // Desenha os marcadores.
  useEffect(() => {
    const m = mapa.current;
    const c = camada.current;
    if (!m || !c) return;
    c.clearLayers();
    for (const p of pontos) {
      const cor = corDoScore(p.score);
      L.circleMarker([p.lat, p.lng], {
        radius: p.score !== null && p.score >= 70 ? 8 : 6,
        color: "#050a18",
        weight: 2,
        fillColor: cor,
        fillOpacity: 0.95,
      })
        .bindPopup(popup(p), { maxWidth: 280 })
        .addTo(c);
    }
    if (pontos.length > 0 && !area) {
      m.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    }
  }, [pontos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seleção de área: arrastar desenha o retângulo.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!modoArea) {
      m.dragging.enable();
      return;
    }
    m.dragging.disable();
    let inicio: L.LatLng | null = null;
    const baixo = (e: L.LeafletMouseEvent) => {
      inicio = e.latlng;
      retangulo.current?.remove();
      retangulo.current = L.rectangle(L.latLngBounds(inicio, inicio), { color: "#6fd3ff", weight: 1.5, fillOpacity: 0.08, dashArray: "4 4" }).addTo(m);
    };
    const mover = (e: L.LeafletMouseEvent) => {
      if (inicio && retangulo.current) retangulo.current.setBounds(L.latLngBounds(inicio, e.latlng));
    };
    const cima = () => {
      if (!inicio || !retangulo.current) return;
      const b = retangulo.current.getBounds();
      inicio = null;
      setModoArea(false);
      setArea(b);
      const dentro = pontos.filter((p) => b.contains([p.lat, p.lng]));
      selecao.definir(dentro.map((p) => p.id));
      toast.success(`${dentro.length} lead(s) na área selecionada.`);
    };
    m.on("mousedown", baixo);
    m.on("mousemove", mover);
    m.on("mouseup", cima);
    return () => {
      m.off("mousedown", baixo);
      m.off("mousemove", mover);
      m.off("mouseup", cima);
    };
  }, [modoArea, pontos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarNaArea() {
    if (!area || termo.trim().length < 2) return;
    const r = await fetch("/api/buscas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termo: termo.trim(),
        provedor: "google_places",
        pais: null,
        local: "Área selecionada no mapa",
        retangulo: { sul: area.getSouth(), oeste: area.getWest(), norte: area.getNorth(), leste: area.getEast() },
        maxRequisicoes: 10,
      }),
    });
    const d = (await r.json()) as { id?: string; erro?: string };
    if (!r.ok || !d.id) {
      toast.error(d.erro ?? "Não foi possível buscar nesta área.");
      return;
    }
    router.push(`/buscar?busca=${d.id}`);
  }

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            type="button"
            aria-pressed={ativos.has(f.chave)}
            onClick={() =>
              setAtivos((a) => {
                const n = new Set(a);
                if (n.has(f.chave)) n.delete(f.chave);
                else {
                  // "sem site" e "site fraco" são excludentes.
                  if (f.chave === "sem") n.delete("ruim");
                  if (f.chave === "ruim") n.delete("sem");
                  n.add(f.chave);
                }
                return n;
              })
            }
            className={cn("h-9 cursor-pointer rounded-lg border px-3 text-sm transition-colors", ativos.has(f.chave) ? "border-brilho/60 bg-azul/15 text-ciano" : "border-fio bg-placa hover:border-brilho/40")}
          >
            {f.rotulo}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setModoArea((m) => !m)}
          aria-pressed={modoArea}
          className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm", modoArea ? "border-ciano bg-ciano/15 text-ciano" : "border-fio bg-placa hover:border-brilho/40")}
        >
          <BoxSelect className="size-4" /> {modoArea ? "Arraste no mapa…" : "Selecionar área"}
        </button>
        <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {carregando && <LoaderCircle className="size-4 animate-spin" />}
          <Layers className="size-4" /> <b className="text-foreground num">{pontos.length.toLocaleString("pt-BR")}</b> no mapa
        </span>
      </div>

      <div className="placa relative overflow-hidden p-0">
        <div ref={elemento} className={cn("h-[calc(100dvh-15rem)] min-h-[26rem] w-full", modoArea && "cursor-crosshair")} role="application" aria-label="Mapa de leads" />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex gap-3 rounded-lg border border-fio bg-background/80 px-3 py-2 text-xs backdrop-blur">
          {[
            ["#6fd3ff", "Score 70+"],
            ["#f5b83d", "45–69"],
            ["#7b88b3", "Abaixo de 45"],
          ].map(([c, r]) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: c }} /> {r}
            </span>
          ))}
        </div>
        {!carregando && pontos.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center">
            <div className="rounded-2xl border border-fio bg-popover/95 px-6 py-5 text-center">
              <p className="font-display font-semibold">Nenhum lead com coordenadas</p>
              <p className="mt-1 text-sm text-muted-foreground">Faça uma busca para os leads aparecerem no mapa.</p>
            </div>
          </div>
        )}
        <AnimatePresence>
          {area && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-3 top-3 z-[400] w-72 rounded-2xl border border-fio bg-popover/95 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold">Área selecionada</p>
                <button
                  type="button"
                  aria-label="Limpar área"
                  onClick={() => {
                    setArea(null);
                    retangulo.current?.remove();
                    selecao.limpar();
                  }}
                  className="flex size-7 items-center justify-center rounded-md hover:bg-white/10"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{selecao.tamanho} lead(s) dentro da área já estão selecionados.</p>
              <label className="mt-3 block space-y-1">
                <span className="rotulo">Buscar novas empresas nesta área</span>
                <div className="flex gap-1.5">
                  <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: dentista" className="h-9 min-w-0 flex-1 rounded-lg border border-fio bg-white/[0.04] px-2.5 text-sm outline-none focus:border-brilho/60" />
                  <button type="button" onClick={buscarNaArea} disabled={termo.trim().length < 2} className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-azul text-white disabled:opacity-50" aria-label="Buscar nesta área">
                    <Search className="size-4" />
                  </button>
                </div>
              </label>
              <p className="mt-1.5 text-[0.7rem] text-muted-foreground">Usa o Google Maps restrito ao retângulo.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BarraMassa ids={selecao.ids} aoLimpar={selecao.limpar} origem="mapa" />
    </div>
  );
}
