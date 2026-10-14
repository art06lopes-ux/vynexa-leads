import { SquareKanban } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { Kanban, type CartaoCrm } from "@/components/crm/kanban";
import { Contador } from "@/components/motion/contador";
import { getBanco, planos } from "@/db/cliente";
import { porEtapa } from "@/db/painel";
import type { EtapaLead } from "@/db/tipos";
import { ETAPAS } from "@/services/crm";

export const metadata = { title: "CRM" };

/** Cartões por coluna: os 40 mais recentes de cada etapa (o total vem à parte). */
const POR_COLUNA = 40;

export default async function PaginaCrm({ searchParams }: PageProps<"/crm">) {
  const { escopo } = await searchParams;
  // "Novo" tem milhares de leads de busca: por padrão o quadro mostra os
  // de maior score nessa coluna, e as demais por atividade recente.
  const banco = getBanco();
  const consultas = ETAPAS.map((etapa) =>
    banco.execute({
      sql: `SELECT l.id lead_id, e.nome, COALESCE(e.categoria_rotulo, e.categoria) categoria, e.cidade, l.score_oportunidade score,
                   l.etapa, l.etapa_em, l.prioridade, e.whatsapp, e.avaliacao_nota,
                   COALESCE((SELECT SUM(v.valor_centavos) FROM vendas v WHERE v.lead_id = l.id AND v.status = 'pago'), 0) vendido_centavos,
                   COALESCE(
                     (SELECT p.valor_centavos FROM propostas p WHERE p.lead_id = l.id AND p.status <> 'recusada' AND p.valor_centavos > 0 ORDER BY p.criado_em DESC LIMIT 1),
                     (SELECT pr.valor_centavos FROM projetos pr WHERE pr.lead_id = l.id AND pr.valor_centavos > 0 ORDER BY pr.atualizado_em DESC LIMIT 1),
                     0) previsto_centavos
            FROM leads l JOIN empresas e ON e.id = l.empresa_id
            WHERE l.etapa = ? ${escopo === "contatar" ? "AND e.nao_contatar = 0" : ""}
            ORDER BY ${etapa === "novo" ? "l.score_oportunidade DESC" : "COALESCE(l.etapa_em, l.atualizado_em) DESC"}
            LIMIT ?`,
      args: [etapa, POR_COLUNA],
    }),
  );
  const [resultados, totais] = await Promise.all([Promise.all(consultas), porEtapa()]);
  const cartoes = resultados.flatMap((r) => planos<CartaoCrm>(r.rows)).map((c) => ({ ...c, vendido_centavos: Number(c.vendido_centavos), previsto_centavos: Number(c.previsto_centavos) }));
  const abertas: EtapaLead[] = ["respondeu", "negociacao", "proposta"];
  const emJogo = abertas.reduce((s, e) => s + Number(totais[e] ?? 0), 0);
  const previsto = cartoes.filter((c) => abertas.includes(c.etapa)).reduce((s, c) => s + c.previsto_centavos, 0);

  return (
    <div>
      <Cabecalho
        icone={SquareKanban}
        secao="Prospecção"
        titulo="CRM"
        descricao={`Cada negociação no estágio certo, com o valor previsto por coluna. Arraste entre as etapas; cada coluna mostra até ${POR_COLUNA} cartões${(totais.novo as number) > POR_COLUNA ? " (em “Novo”, os de maior score)" : ""}.`}
        numeros={[
          { valor: <Contador valor={emJogo} />, rotulo: "negociações abertas" },
          { valor: <Contador valor={previsto} formato="moeda" />, rotulo: "valor previsto" },
          { valor: <Contador valor={(totais.fechado as number) ?? 0} />, rotulo: "fechados" },
        ]}
      />
      <Kanban iniciais={cartoes} totais={totais as Record<EtapaLead, number>} />
    </div>
  );
}
