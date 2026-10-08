import "server-only";

import { contarLeads } from "@/db/leads";

/** Abas de Leads, compartilhadas com o Mapa. A busca (se houver) acompanha as abas. */
export async function abasDeLeads(buscaId?: string | null) {
  const extra = buscaId ? `busca=${encodeURIComponent(buscaId)}` : "";
  const [paraAbordar, todos] = await Promise.all([
    contarLeads({ paraAbordar: true, busca: buscaId ?? undefined }),
    contarLeads({ busca: buscaId ?? undefined }),
  ]);
  return [
    { chave: "abordar", rotulo: "Para abordar", href: `/leads?aba=abordar${extra ? `&${extra}` : ""}`, numero: paraAbordar },
    { chave: "todos", rotulo: "Todos", href: `/leads${extra ? `?${extra}` : ""}`, numero: todos },
    { chave: "mapa", rotulo: "Mapa", href: `/mapa${extra ? `?${extra}` : ""}` },
  ];
}
