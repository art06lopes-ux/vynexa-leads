"use client";

import { createContext, useContext } from "react";

import type { Recurso } from "@/lib/planos";

/** O que a moldura do painel sabe da conta: plano, recursos e se é o dono do SaaS. */
export type ContaShell = {
  recursos: Recurso[];
  ehDono: boolean;
  planoNome: string;
  /** Faixa de aviso no topo (teste acabando, cobrança vencida). */
  aviso: { texto: string; tom: "info" | "alerta" } | null;
};

const Contexto = createContext<ContaShell>({ recursos: [], ehDono: false, planoNome: "", aviso: null });

export function ProvedorConta({ valor, children }: { valor: ContaShell; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConta(): ContaShell {
  return useContext(Contexto);
}
