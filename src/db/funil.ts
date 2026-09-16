import "server-only";

import { getBanco, planos } from "@/db/cliente";
import type { StatusLead } from "@/db/tipos";
import { ETAPAS } from "@/lib/leads/etapas";

export type CartaoFunil = {
  lead_id: string;
  empresa_id: string;
  nome: string;
  categoria: string;
  cidade: string | null;
  estado: string | null;
  pais: string;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  mensagem_gerada: string | null;
  score_oportunidade: number | null;
  status: StatusLead;
  status_em: string | null;
  observacao: string | null;
  /** Soma das vendas pagas ligadas a este lead, em centavos. */
  vendido_centavos: number;
};

export type ResumoFunil = {
  porEtapa: Record<StatusLead, number>;
  /** Vendas pagas ligadas a leads, em centavos. */
  fechado_centavos: number;
  /** (respondeu + fechado) / (todos que foram contatados). Nulo sem contatados. */
  taxaResposta: number | null;
  /** fechado / contatados. */
  taxaFechamento: number | null;
};

/** Leads por etapa, mais recentes primeiro. Só quem tem lead: empresa sem etapa não está no funil. */
export async function listarFunil(limitePorEtapa = 60): Promise<Record<StatusLead, CartaoFunil[]>> {
  const banco = getBanco();
  const resultado = Object.fromEntries(ETAPAS.map((e) => [e, [] as CartaoFunil[]])) as Record<StatusLead, CartaoFunil[]>;

  for (const etapa of ETAPAS) {
    const { rows } = await banco.execute({
      sql: `SELECT l.id AS lead_id, e.id AS empresa_id, e.nome, e.categoria, e.cidade, e.estado, e.pais,
                   e.telefone, e.email, e.instagram, l.mensagem_gerada, l.score_oportunidade, l.status, l.status_em, l.observacao,
                   COALESCE((SELECT SUM(v.valor_centavos) FROM vendas v WHERE v.lead_id = l.id AND v.status = 'pago'), 0) AS vendido_centavos
            FROM leads l JOIN empresas e ON e.id = l.empresa_id
            WHERE l.status = ?
            ORDER BY COALESCE(l.status_em, l.atualizado_em) DESC
            LIMIT ?`,
      args: [etapa, limitePorEtapa],
    });
    resultado[etapa] = planos<CartaoFunil>(rows);
  }
  return resultado;
}

export async function resumoFunil(): Promise<ResumoFunil> {
  const banco = getBanco();
  const [{ rows: contagem }, { rows: vendido }] = await Promise.all([
    banco.execute(`SELECT status, COUNT(*) AS n FROM leads GROUP BY status`),
    banco.execute(`SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM vendas WHERE status = 'pago' AND lead_id IS NOT NULL`),
  ]);

  const porEtapa = Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<StatusLead, number>;
  for (const r of contagem) porEtapa[String(r.status) as StatusLead] = Number(r.n);

  const contatados = porEtapa.contatado + porEtapa.respondeu + porEtapa.fechado + porEtapa.nao_interessado;
  return {
    porEtapa,
    fechado_centavos: Number(vendido[0]?.total ?? 0),
    taxaResposta: contatados > 0 ? Math.round(((porEtapa.respondeu + porEtapa.fechado) / contatados) * 100) : null,
    taxaFechamento: contatados > 0 ? Math.round((porEtapa.fechado / contatados) * 100) : null,
  };
}

/** Taxas por segmento: onde vale a pena caçar mais. */
export async function funilPorSegmento(): Promise<
  Array<{ categoria: string; contatados: number; responderam: number; fechados: number }>
> {
  const { rows } = await getBanco().execute(
    `SELECT e.categoria,
            SUM(l.status IN ('contatado','respondeu','fechado','nao_interessado')) AS contatados,
            SUM(l.status IN ('respondeu','fechado')) AS responderam,
            SUM(l.status = 'fechado') AS fechados
     FROM leads l JOIN empresas e ON e.id = l.empresa_id
     GROUP BY e.categoria
     HAVING contatados > 0
     ORDER BY fechados DESC, responderam DESC, contatados DESC
     LIMIT 12`,
  );
  return rows.map((r) => ({
    categoria: String(r.categoria),
    contatados: Number(r.contatados),
    responderam: Number(r.responderam),
    fechados: Number(r.fechados),
  }));
}
