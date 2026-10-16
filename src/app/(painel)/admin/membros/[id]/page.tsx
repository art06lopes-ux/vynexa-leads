import { notFound } from "next/navigation";
import { Building2, Receipt, Users } from "lucide-react";

import { AcoesMembro } from "@/components/admin/acoes-membro";
import { dataCurta, SeloStatus } from "@/components/admin/comum";
import { Cabecalho, Cartao } from "@/components/base/cartao";
import { formatarPreco } from "@/lib/planos";
import { usoHistorico, usuariosDaConta } from "@/services/admin";
import { acessoDaConta, diasRestantes, lerConta, listarFaturas, planoPorId } from "@/services/contas";
import { exigirDono } from "@/server/sessao";

export const metadata = { title: "Membro" };

export default async function PaginaMembro({ params }: PageProps<"/admin/membros/[id]">) {
  await exigirDono();
  const { id } = await params;
  const conta = await lerConta(id);
  if (!conta || id === "principal") notFound();
  const [usuarios, faturas, uso, plano] = await Promise.all([usuariosDaConta(id), listarFaturas(id), usoHistorico(id), planoPorId(conta.plano)]);
  const acesso = acessoDaConta(conta);
  const titular = usuarios.find((u) => u.papel === "dono");
  const dias = diasRestantes(conta);
  const whats = conta.telefone ? conta.telefone.replace(/\D/g, "") : null;

  return (
    <div>
      <Cabecalho
        icone={Building2}
        titulo={conta.nome}
        trilha={[
          { href: "/admin", rotulo: "Painel de membros" },
          { href: "/admin/membros", rotulo: "Membros" },
        ]}
        descricao={`${titular?.nome ?? ""} · ${titular?.email ?? ""}${whats ? ` · WhatsApp ${whats}` : ""}`}
        acoes={
          whats ? (
            <a href={`https://wa.me/${whats.startsWith("55") ? whats : `55${whats}`}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border border-fio px-3 text-sm font-semibold hover:border-brilho/40">
              Chamar no WhatsApp
            </a>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-5">
          <Cartao titulo="Situação" subtitulo={`Plano ${plano.nome} · ${formatarPreco(plano.precoCentavos)}/mês`}>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Situação</dt>
                <dd className="mt-1">
                  <SeloStatus status={conta.status} liberado={acesso.liberado} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Válida até</dt>
                <dd className="num mt-1 font-semibold">
                  {dataCurta(conta.valida_ate)} {dias !== null && <span className="font-normal text-muted-foreground">({dias >= 0 ? `faltam ${dias}d` : `venceu há ${-dias}d`})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cadastro</dt>
                <dd className="num mt-1 font-semibold">{dataCurta(conta.criado_em)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Banco</dt>
                <dd className="mt-1 font-semibold">{conta.banco_tipo === "pendente" ? <span className="text-perigo">não criado</span> : conta.banco_tipo === "d1" ? "Cloudflare D1" : "arquivo local"}</dd>
              </div>
            </dl>
            {conta.documento && <p className="mt-4 text-xs text-muted-foreground">CPF/CNPJ: {conta.documento} · Assinatura Asaas: {conta.asaas_assinatura_id ?? "—"}</p>}
          </Cartao>

          <Cartao icone={Users} titulo="Uso por mês" subtitulo="Leads novos e análises de IA da Vynexa">
            {uso.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não buscou nada.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Mês</th>
                    <th className="pb-2 text-right font-medium">Leads</th>
                    <th className="pb-2 text-right font-medium">IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fio">
                  {uso.map((u) => (
                    <tr key={u.mes}>
                      <td className="num py-2">{u.mes.split("-").reverse().join("/")}</td>
                      <td className="num py-2 text-right">
                        {u.leads.toLocaleString("pt-BR")}
                        {plano.limites.leads_mes !== null && <span className="text-muted-foreground"> / {plano.limites.leads_mes.toLocaleString("pt-BR")}</span>}
                      </td>
                      <td className="num py-2 text-right">{u.ia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao icone={Receipt} titulo="Cobranças" corpoClassName="px-0 pb-2">
            {faturas.length === 0 ? (
              <p className="px-5 pb-3 text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
            ) : (
              <ul className="divide-y divide-fio">
                {faturas.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                    <span className="num w-20 text-muted-foreground">{dataCurta(f.vencimento ?? f.criado_em)}</span>
                    <span className="flex-1 text-xs font-semibold uppercase">{f.plano}</span>
                    <span className="num font-semibold">{formatarPreco(f.valor_centavos)}</span>
                    <span className="w-28 text-right text-xs text-muted-foreground">{f.status}{f.forma ? ` · ${f.forma.toLowerCase()}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao icone={Users} titulo="Pessoas na conta">
            <ul className="space-y-2 text-sm">
              {usuarios.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{u.nome}</span> <span className="text-muted-foreground">· {u.email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {u.papel === "dono" ? "Titular" : "Equipe"} · último acesso {dataCurta(u.ultimo_acesso_em)}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>

        <AcoesMembro
          conta={{ id: conta.id, nome: conta.nome, plano: conta.plano, status: conta.status, observacao: conta.observacao, semBanco: conta.banco_tipo === "pendente", temAssinatura: Boolean(conta.asaas_assinatura_id) }}
        />
      </div>
    </div>
  );
}
