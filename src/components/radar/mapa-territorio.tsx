"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import { CORES_AREA, type Area, type Foco } from "./territorio";

/**
 * Mapa do território do Radar. Clique marca uma área (até 3); o pino de
 * cada área arrasta; o círculo mostra o raio que será varrido no Google.
 */

function icone(n: number, cor: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:999px;background:${cor};color:#1a0802;display:flex;align-items:center;justify-content:center;font:700 12px var(--font-sora),system-ui;box-shadow:0 0 0 3px rgba(11,10,9,.85),0 8px 20px -6px ${cor}">P${n}</div>`,
  });
}

export default function MapaTerritorio({
  areas,
  foco,
  maxAreas,
  aoAdicionar,
  aoMover,
}: {
  areas: Area[];
  foco: Foco | null;
  maxAreas: number;
  aoAdicionar: (lat: number, lng: number) => void;
  aoMover: (id: string, lat: number, lng: number) => void;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  // As funções mudam a cada render; o mapa lê sempre a versão atual.
  const chamadas = useRef({ aoAdicionar, aoMover, cheio: areas.length >= maxAreas });
  useEffect(() => {
    chamadas.current = { aoAdicionar, aoMover, cheio: areas.length >= maxAreas };
  });

  useEffect(() => {
    if (!elemento.current || mapa.current) return;
    // A roda do mouse rola a página; só dá zoom depois de clicar no mapa.
    const m = L.map(elemento.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([-3.3, -60.62], 12);
    m.on("focus click", () => m.scrollWheelZoom.enable());
    m.on("blur mouseout", () => m.scrollWheelZoom.disable());
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      className: "mapa-escuro",
    }).addTo(m);
    camada.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (!chamadas.current.cheio) chamadas.current.aoAdicionar(e.latlng.lat, e.latlng.lng);
    });
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !foco) return;
    // Município grande (Manacapuru tem 7 mil km²) caberia inteiro e a
    // cidade viraria um ponto: só estados e regiões enquadram a caixa toda.
    const grande = foco.bbox && Math.max(foco.bbox.norte - foco.bbox.sul, foco.bbox.leste - foco.bbox.oeste) > 2.5;
    if (foco.bbox && grande) {
      m.fitBounds([
        [foco.bbox.sul, foco.bbox.oeste],
        [foco.bbox.norte, foco.bbox.leste],
      ], { maxZoom: 14, padding: [20, 20] });
    } else {
      m.setView([foco.lat, foco.lng], foco.zoom ?? 13, { animate: true });
    }
  }, [foco]);

  useEffect(() => {
    const g = camada.current;
    if (!g) return;
    g.clearLayers();
    areas.forEach((a, i) => {
      const cor = CORES_AREA[i % CORES_AREA.length];
      const circulo = L.circle([a.lat, a.lng], { radius: a.raioKm * 1000, color: cor, weight: 2, fillColor: cor, fillOpacity: 0.12, interactive: false });
      const pino = L.marker([a.lat, a.lng], { draggable: true, icon: icone(i + 1, cor), keyboard: true, title: `Área P${i + 1}` });
      pino.on("drag", (e) => circulo.setLatLng((e.target as L.Marker).getLatLng()));
      pino.on("dragend", (e) => {
        const p = (e.target as L.Marker).getLatLng();
        chamadas.current.aoMover(a.id, p.lat, p.lng);
      });
      g.addLayer(circulo);
      g.addLayer(pino);
    });
  }, [areas]);

  return <div ref={elemento} className="h-full w-full" role="application" aria-label="Mapa do território: clique para marcar uma área" />;
}
