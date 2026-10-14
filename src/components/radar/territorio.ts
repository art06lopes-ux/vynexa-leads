/** Tipos e cores do território, sem Leaflet — seguros para o servidor. */

export type Area = { id: string; lat: number; lng: number; raioKm: number };
export type Foco = { lat: number; lng: number; zoom?: number; bbox?: { sul: number; oeste: number; norte: number; leste: number } };

export const CORES_AREA = ["#ff5a1f", "#ffb347", "#f4ede6"] as const;
