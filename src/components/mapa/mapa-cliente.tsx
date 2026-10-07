"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

/** O Leaflet mexe em `window` ao carregar: só no navegador. */
const MapaLeads = dynamic(() => import("./mapa-leads"), {
  ssr: false,
  loading: () => <div className="esqueleto h-[calc(100dvh-15rem)] min-h-[26rem] w-full rounded-2xl" />,
});

export function MapaCliente() {
  return (
    <Suspense>
      <MapaLeads />
    </Suspense>
  );
}
