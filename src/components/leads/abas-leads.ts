import "server-only";

import { contarLeads } from "@/db/leads";

/** Abas de Leads (lista e mapa). A busca escolhida, se houver, acompanha. */
export async function abasDeLeads(buscaId?: string | null) {
  const extra = buscaId ? `?busca=${encodeURIComponent(buscaId)}` : "";
  const total = await contarLeads({ busca: buscaId ?? undefined });
  return [
    { chave: "lista", rotulo: "Lista", href: `/leads${extra}`, numero: total },
    { chave: "mapa", rotulo: "Mapa", href: `/mapa${extra}` },
  ];
}
