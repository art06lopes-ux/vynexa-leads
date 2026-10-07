import { SquareKanban } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { Kanban, type CartaoCrm } from "@/components/crm/kanban";
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
                   l.etapa, l.etapa_em, e.whatsapp, e.avaliacao_nota,
                   COALESCE((SELECT SUM(v.valor_centavos) FROM vendas v WHERE v.lead_id = l.id AND v.status = 'pago'), 0) vendido_centavos
            FROM leads l JOIN empresas e ON e.id = l.empresa_id
            WHERE l.etapa = ? ${escopo === "contatar" ? "AND e.nao_contatar = 0" : ""}
            ORDER BY ${etapa === "novo" ? "l.score_oportunidade DESC" : "COALESCE(l.etapa_em, l.atualizado_em) DESC"}
            LIMIT ?`,
      args: [etapa, POR_COLUNA],
    }),
  );
  const [resultados, totais] = await Promise.all([Promise.all(consultas), porEtapa()]);
  const cartoes = resultados.flatMap((r) => planos<CartaoCrm>(r.rows));

  return (
    <div>
      <Cabecalho
        icone={SquareKanban}
        titulo="CRM"
        descricao={`Arraste os leads entre as etapas. Cada coluna mostra até ${POR_COLUNA} cartões${(totais.novo as number) > POR_COLUNA ? " — em “Novo”, os de maior score" : ""}; a lista completa fica em Leads.`}
      />
      <Kanban iniciais={cartoes} totais={totais as Record<EtapaLead, number>} />
    </div>
  );
}
