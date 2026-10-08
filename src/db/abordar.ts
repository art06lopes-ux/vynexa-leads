import "server-only";

import type { Client, InValue } from "@libsql/client";

import type { MotivoScore } from "@/db/tipos";
import { normalizarTelefone } from "@/lib/leads/whatsapp";

/**
 * A fila de abordagem: quem ainda não foi contatado, com algum canal
 * (WhatsApp ou e-mail), do melhor score para o pior. É o que alimenta a
 * tela "Abordar" — o operador passa pela lista sem abrir lead por lead.
 */

export type ItemFila = {
  leadId: string;
  nome: string;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
  score: number | null;
  motivos: string[];
  numeroWhats: string | null;
  email: string | null;
  statusSite: string | null;
  avaliacaoNota: number | null;
  avaliacaoQtd: number | null;
  /** Última mensagem de WhatsApp já escrita pela IA, se houver. */
  mensagem: string | null;
};

export type CriterioFila = { buscaId?: string | null; leadIds?: string[] | null; limite?: number };

export async function carregarFila(banco: Client, c: CriterioFila): Promise<ItemFila[]> {
  const onde = [
    "e.nao_contatar = 0",
    "l.contatado_em IS NULL",
    "l.etapa IN ('novo', 'qualificado')",
    "(e.whatsapp = 1 OR (e.email IS NOT NULL AND e.email <> ''))",
  ];
  const args: InValue[] = [];
  if (c.buscaId) {
    onde.push("e.id IN (SELECT empresa_id FROM busca_resultados WHERE busca_id = ?)");
    args.push(c.buscaId);
  }
  if (c.leadIds && c.leadIds.length > 0) {
    const ids = c.leadIds.slice(0, 1000);
    onde.push(`l.id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }

  const { rows } = await banco.execute({
    sql: `SELECT l.id AS lead_id, e.nome, COALESCE(e.categoria_rotulo, e.categoria) AS categoria, e.cidade, e.estado, e.pais,
                 e.telefone, e.whatsapp, e.email, e.status_site, e.avaliacao_nota, e.avaliacao_qtd,
                 l.score_oportunidade, l.score_motivos,
                 (SELECT m.corpo FROM mensagens m WHERE m.lead_id = l.id AND m.tipo = 'whatsapp' ORDER BY m.criado_em DESC LIMIT 1) AS mensagem
          FROM leads l JOIN empresas e ON e.id = l.empresa_id
          WHERE ${onde.join(" AND ")}
          ORDER BY l.score_oportunidade DESC NULLS LAST, e.avaliacao_qtd DESC NULLS LAST
          LIMIT ?`,
    args: [...args, Math.min(Math.max(c.limite ?? 300, 1), 1000)],
  });

  return rows.map((r) => {
    let motivos: string[] = [];
    try {
      motivos = r.score_motivos
        ? (JSON.parse(String(r.score_motivos)) as MotivoScore[]).filter((m) => m.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 3).map((m) => m.motivo)
        : [];
    } catch {
      motivos = [];
    }
    return {
      leadId: String(r.lead_id),
      nome: String(r.nome),
      categoria: r.categoria ? String(r.categoria) : null,
      cidade: r.cidade ? String(r.cidade) : null,
      estado: r.estado ? String(r.estado) : null,
      score: r.score_oportunidade === null ? null : Number(r.score_oportunidade),
      motivos,
      numeroWhats: Number(r.whatsapp) === 1 ? normalizarTelefone(r.telefone ? String(r.telefone) : null, String(r.pais ?? "BR")) : null,
      email: r.email ? String(r.email) : null,
      statusSite: r.status_site ? String(r.status_site) : null,
      avaliacaoNota: r.avaliacao_nota === null ? null : Number(r.avaliacao_nota),
      avaliacaoQtd: r.avaliacao_qtd === null ? null : Number(r.avaliacao_qtd),
      mensagem: r.mensagem ? String(r.mensagem) : null,
    };
  });
}
