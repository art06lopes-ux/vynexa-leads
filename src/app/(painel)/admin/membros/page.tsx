import { Search, Users } from "lucide-react";
import Link from "next/link";

import { AbasAdmin, dataCurta, LinkMembro, ROTULO_STATUS, SeloStatus } from "@/components/admin/comum";
import { Cabecalho, Vazio } from "@/components/base/cartao";
import { cn } from "@/lib/utils";
import { listarMembros } from "@/services/admin";
import { exigirDono } from "@/server/sessao";

export const metadata = { title: "Membros" };

const STATUS = ["teste", "ativa", "atrasada", "cancelada", "bloqueada"] as const;

export default async function PaginaMembros({ searchParams }: PageProps<"/admin/membros">) {
  await exigirDono();
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" && (STATUS as readonly string[]).includes(sp.status) ? sp.status : "";
  const [membros, todos] = await Promise.all([listarMembros({ busca, status }), listarMembros()]);

  return (
    <div>
      <Cabecalho icone={Users} titulo="Membros" trilha={[{ href: "/admin", rotulo: "Painel de membros" }]} descricao="Todas as contas que se cadastraram. Toque numa para ver o uso, as cobranças e mudar plano ou prazo." />
      <AbasAdmin ativa="membros" membros={todos.length} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative flex-1 lg:max-w-sm" action="/admin/membros">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={busca} placeholder="Nome, empresa ou e-mail" aria-label="Procurar membro" className="h-10 w-full rounded-xl border border-fio bg-placa pl-9 pr-3 text-sm outline-none focus-visible:border-brilho/60" />
        </form>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por situação">
          {[["", "Todas"] as const, ...STATUS.map((s) => [s, ROTULO_STATUS[s]] as const)].map(([valor, rotulo]) => (
            <Link
              key={valor || "todas"}
              href={`/admin/membros?${new URLSearchParams({ ...(busca ? { q: busca } : {}), ...(valor ? { status: valor } : {}) })}`}
              aria-current={status === valor ? "true" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", status === valor ? "border-brilho/60 bg-azul/15 text-ciano" : "border-fio text-muted-foreground hover:text-foreground")}
            >
              {rotulo} <span className="num opacity-70">{valor ? todos.filter((m) => m.status === valor).length : todos.length}</span>
            </Link>
          ))}
        </nav>
      </div>

      <section className="placa overflow-hidden">
        {membros.length === 0 ? (
          <Vazio icone={Users} titulo={busca || status ? "Ninguém com esse filtro" : "Nenhum assinante ainda"} descricao={busca || status ? "Tente outro nome ou situação." : "Divulgue a página de vendas: cada cadastro aparece aqui."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-fio text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Conta</th>
                  <th className="px-3 py-3 font-medium">Plano</th>
                  <th className="px-3 py-3 font-medium">Situação</th>
                  <th className="px-3 py-3 font-medium">Válida até</th>
                  <th className="px-3 py-3 text-right font-medium">Leads no mês</th>
                  <th className="px-3 py-3 font-medium">Último acesso</th>
                  <th className="px-5 py-3 font-medium">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fio">
                {membros.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <LinkMembro id={m.id}>{m.nome}</LinkMembro>
                      <p className="text-xs text-muted-foreground">
                        {m.titular_nome} · {m.titular_email}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold uppercase">{m.plano}</td>
                    <td className="px-3 py-3">
                      <SeloStatus status={m.status} liberado={m.liberado} />
                    </td>
                    <td className="num px-3 py-3 text-muted-foreground">{dataCurta(m.valida_ate)}</td>
                    <td className="num px-3 py-3 text-right">{m.leads_mes.toLocaleString("pt-BR")}</td>
                    <td className="num px-3 py-3 text-muted-foreground">{dataCurta(m.ultimo_acesso_em)}</td>
                    <td className="num px-5 py-3 text-muted-foreground">{dataCurta(m.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
