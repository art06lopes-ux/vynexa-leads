import { GooglePlacesProvider } from "./google-places";
import { OsmProvider } from "./osm";
import type { LeadProvider } from "./tipos";

/**
 * Registro dos provedores de busca. O Google Maps é a fonte principal;
 * o OpenStreetMap fica como alternativa gratuita. CSV e cadastro manual
 * não "buscam" — entram direto pelo registro (`src/services/registro.ts`).
 */
export type ProvedorBusca = "google_places" | "osm";

const provedores: Record<ProvedorBusca, () => LeadProvider> = {
  google_places: () => new GooglePlacesProvider(),
  osm: () => new OsmProvider(),
};

export function obterProvedor(nome: ProvedorBusca): LeadProvider {
  return provedores[nome]();
}

export function ehProvedorBusca(valor: unknown): valor is ProvedorBusca {
  return valor === "google_places" || valor === "osm";
}

export async function estadoDosProvedores(): Promise<Array<{ nome: ProvedorBusca; rotulo: string; disponivel: boolean }>> {
  return Promise.all(
    (Object.keys(provedores) as ProvedorBusca[]).map(async (nome) => {
      const p = obterProvedor(nome);
      return { nome, rotulo: p.rotulo, disponivel: await p.disponivel() };
    }),
  );
}

export * from "./tipos";
