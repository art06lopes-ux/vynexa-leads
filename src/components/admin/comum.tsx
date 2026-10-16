import Link from "next/link";

import { AbasPagina } from "@/components/base/abas-pagina";
import { cn } from "@/lib/utils";
import type { Conta } from "@/services/contas";

/** Peças compartilhadas do painel de membros. */

export function AbasAdmin({ ativa, membros }: { ativa: "geral" | "membros" | "planos"; membros?: number }) {
  return (
    <AbasPagina
      ativa={ativa}
      abas={[
        { chave: "geral", rotulo: "Visão geral", href: "/admin" },
        { chave: "membros", rotulo: "Membros", href: "/admin/membros", numero: membros },
        { chave: "planos", rotulo: "Planos e teste", href: "/admin/planos" },
      ]}
    />
  );
}

export const ROTULO_STATUS: Record<Conta["status"], string> = {
  teste: "Teste",
  ativa: "Ativa",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
  bloqueada: "Bloqueada",
};

export function SeloStatus({ status, liberado }: { status: Conta["status"]; liberado?: boolean }) {
  const tom =
    status === "ativa"
      ? "bg-sucesso/15 text-sucesso"
      : status === "teste"
        ? "bg-azul/15 text-ciano"
        : status === "atrasada" || status === "bloqueada"
          ? "bg-perigo/15 text-perigo"
          : "bg-white/10 text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold", tom)}>
      {ROTULO_STATUS[status]}
      {liberado === false && status !== "bloqueada" && <span className="font-normal opacity-80">· sem acesso</span>}
    </span>
  );
}

export function dataCurta(d: string | null | undefined): string {
  if (!d) return "—";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${a.slice(2)}`;
}

export function LinkMembro({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/admin/membros/${id}`} className={cn("font-medium hover:text-ciano", className)}>
      {children}
    </Link>
  );
}
