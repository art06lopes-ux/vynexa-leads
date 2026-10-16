import { Crown, TrendingUp, UserPlus } from "lucide-react";

import { AbasAdmin, dataCurta, LinkMembro, SeloStatus } from "@/components/admin/comum";
import { Cabecalho, Cartao, Vazio } from "@/components/base/cartao";
import { formatarPreco } from "@/lib/planos";
import { listarMembros, resumoAdmin } from "@/services/admin";
import { exigirDono } from "@/server/sessao";

export const metadata = { title: "Painel de membros" };

export default async function PaginaAdmin() {
  await exigirDono();
  const [r, membros] = await Promise.all([resumoAdmin(), listarMembros()]);
  const maior = Math.max(1, ...r.porPlano.map((p) => p.ativas));

  return (
    <div>
      <Cabecalho
        icone={Crown}
        secao="Admin"
        titulo="Painel de membros"
        descricao="Quem assina, quanto entra por mês e quem precisa de atenção. Você tem acesso total a tudo."
        numeros={[
          { rotulo: "Receita recorrente (MRR)", valor: formatarPreco(r.mrrCentavos) },
          { rotulo: "Recebido no mês", valor: formatarPreco(r.recebidoMesCentavos) },
          { rotulo: "Assinantes ativos", valor: r.ativas },
          { rotulo: "Em teste grátis", valor: r.emTeste },
        ]}
      />
      <AbasAdmin ativa="geral" membros={membros.length} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Cartao icone={TrendingUp} titulo="Por plano" subtitulo="Assinantes ativos e quanto cada plano rende">
          <ul className="space-y-4">
            {r.porPlano.map((p) => (
              <li key={p.plano}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{p.nome}</span>
                  <span className="num text-muted-foreground">
                    {p.ativas} · <span className="font-semibold text-foreground">{formatarPreco(p.mrrCentavos)}</span>/mês
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff7a45] to-[#ffb347]" style={{ width: `${(p.ativas / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-fio p-3">
              <dt className="text-xs text-muted-foreground">Cadastros em 7 dias</dt>
              <dd className="num font-display text-xl font-semibold">{r.novas7d}</dd>
            </div>
            <div className="rounded-xl border border-fio p-3">
              <dt className="text-xs text-muted-foreground">Cadastros em 30 dias</dt>
              <dd className="num font-display text-xl font-semibold">{r.novas30d}</dd>
            </div>
            <div className="rounded-xl border border-fio p-3">
              <dt className="text-xs text-muted-foreground">Atrasadas</dt>
              <dd className="num font-display text-xl font-semibold text-perigo">{r.atrasadas}</dd>
            </div>
            <div className="rounded-xl border border-fio p-3">
              <dt className="text-xs text-muted-foreground">Viraram pagantes</dt>
              <dd className="num font-display text-xl font-semibold">{r.conversao === null ? "—" : `${Math.round(r.conversao * 100)}%`}</dd>
            </div>
          </dl>
        </Cartao>

        <Cartao icone={UserPlus} titulo="Cadastros recentes" subtitulo="Os últimos que entraram" href="/admin/membros" className="xl:col-span-2" corpoClassName="px-0 pb-2">
          {membros.length === 0 ? (
            <Vazio icone={UserPlus} titulo="Nenhum assinante ainda" descricao="Quando alguém se cadastrar pela página de vendas, aparece aqui — e você recebe um aviso no celular." />
          ) : (
            <ul className="divide-y divide-fio">
              {membros.slice(0, 8).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <LinkMembro id={m.id}>{m.nome}</LinkMembro>
                    <p className="truncate text-xs text-muted-foreground">{m.titular_email}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">{m.plano}</span>
                  <SeloStatus status={m.status} liberado={m.liberado} />
                  <span className="num w-16 text-right text-xs text-muted-foreground">{dataCurta(m.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
