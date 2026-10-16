import { Gem } from "lucide-react";
import { redirect } from "next/navigation";

import { Cabecalho } from "@/components/base/cartao";
import { TelaAssinatura } from "@/components/assinatura/tela-assinatura";
import { planoQueLibera, type Recurso } from "@/lib/planos";
import { cobrancaDisponivel } from "@/services/assinatura";
import { diasRestantes, listarFaturas, listarPlanos, usoDoMes } from "@/services/contas";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Assinatura" };

const NOME_RECURSO: Record<Recurso, string> = {
  radar_google: "A busca no Google Maps",
  ia: "A IA (mensagens e análise de site)",
  ao_vivo: "A Sala ao vivo",
  campanhas: "As campanhas de e-mail",
  prompts: "O gerador de prompts",
  clientes: "A carteira de Clientes",
  sites: "O portfólio de Sites",
  vendas: "O controle de Vendas",
  exportar: "Exportar planilha",
  receita: "A base da Receita Federal",
  admin: "O painel de membros",
};

export default async function PaginaAssinatura({ searchParams }: PageProps<"/assinatura">) {
  const sessao = await exigirSessao();
  if (sessao.ehDono) redirect("/admin");
  const { recurso } = await searchParams;
  const recursoPedido = typeof recurso === "string" && recurso in NOME_RECURSO ? (recurso as Recurso) : null;

  const [planos, uso, faturas, cobranca] = await Promise.all([listarPlanos(), usoDoMes(sessao.conta.id), listarFaturas(sessao.conta.id), cobrancaDisponivel()]);
  const liberaEm = recursoPedido ? planoQueLibera(recursoPedido) : null;

  return (
    <div>
      <Cabecalho icone={Gem} secao="Conta" titulo="Assinatura" descricao="Seu plano, o uso do mês e os pagamentos. Troque de plano quando quiser: a diferença entra na próxima cobrança." />
      <TelaAssinatura
        conta={{ nome: sessao.conta.nome, plano: sessao.conta.plano, status: sessao.conta.status, validaAte: sessao.conta.valida_ate, diasRestantes: diasRestantes(sessao.conta), documento: sessao.conta.documento, temAssinatura: Boolean(sessao.conta.asaas_assinatura_id) }}
        titular={sessao.usuario.papel === "dono"}
        liberado={sessao.acesso.liberado}
        planos={planos}
        uso={uso}
        faturas={faturas}
        cobrancaPronta={cobranca}
        pedido={recursoPedido && liberaEm ? { texto: `${NOME_RECURSO[recursoPedido]} faz parte do plano ${liberaEm === "pro" ? "PRO" : "Agência"}.`, plano: liberaEm } : null}
      />
    </div>
  );
}
