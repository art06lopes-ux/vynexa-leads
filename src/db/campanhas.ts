import "server-only";

import { getBanco, plano, planos } from "@/db/cliente";
import type { StatusCampanha, StatusEnvio } from "@/db/tipos";

export type CampanhaListada = {
  id: string;
  nome: string;
  descricao: string | null;
  status: StatusCampanha;
  provedor_email: string | null;
  ritmo_por_hora: number;
  limite_diario: number;
  followup_ativo: number;
  followup_dias: string | null;
  agendada_para: string | null;
  autorizada_em: string | null;
  total_leads: number;
  enviados: number;
  falhas: number;
  abertos: number;
  cliques: number;
  respostas: number;
  criado_em: string;
  concluida_em: string | null;
  preparados: number;
  pendentes: number;
  vendas_centavos: number;
};

const SELECT = `SELECT c.*,
  (SELECT COUNT(*) FROM envios e WHERE e.campanha_id = c.id AND e.passo = 0 AND e.status <> 'pendente' AND e.corpo IS NOT NULL) AS preparados,
  (SELECT COUNT(*) FROM envios e WHERE e.campanha_id = c.id AND e.status = 'pendente') AS pendentes,
  (SELECT COALESCE(SUM(v.valor_centavos), 0) FROM vendas v WHERE v.campanha_id = c.id AND v.status = 'pago') AS vendas_centavos
  FROM campanhas c`;

export async function listarCampanhas(): Promise<CampanhaListada[]> {
  const { rows } = await getBanco().execute(`${SELECT} ORDER BY c.criado_em DESC LIMIT 100`);
  return planos<CampanhaListada>(rows);
}

export async function obterCampanha(id: string): Promise<CampanhaListada | null> {
  const { rows } = await getBanco().execute({ sql: `${SELECT} WHERE c.id = ?`, args: [id] });
  return rows[0] ? plano<CampanhaListada>(rows[0]) : null;
}

export type EnvioDaCampanha = {
  id: string;
  lead_id: string;
  passo: number;
  destinatario: string | null;
  assunto: string | null;
  corpo: string | null;
  status: StatusEnvio;
  erro: string | null;
  agendado_para: string | null;
  enviado_em: string | null;
  aberto_em: string | null;
  clicado_em: string | null;
  respondido_em: string | null;
  empresa: string;
  cidade: string | null;
};

export async function enviosDaCampanha(id: string, limite = 500): Promise<EnvioDaCampanha[]> {
  const { rows } = await getBanco().execute({
    sql: `SELECT en.id, en.lead_id, en.passo, en.destinatario, en.assunto, en.corpo, en.status, en.erro, en.agendado_para, en.enviado_em,
                 en.aberto_em, en.clicado_em, en.respondido_em, e.nome AS empresa, e.cidade
          FROM envios en JOIN leads l ON l.id = en.lead_id JOIN empresas e ON e.id = l.empresa_id
          WHERE en.campanha_id = ? ORDER BY en.passo, e.nome LIMIT ?`,
    args: [id, limite],
  });
  return planos<EnvioDaCampanha>(rows);
}

export async function contagemPorStatus(id: string): Promise<Record<string, number>> {
  const { rows } = await getBanco().execute({ sql: `SELECT status, COUNT(*) n FROM envios WHERE campanha_id = ? GROUP BY status`, args: [id] });
  return Object.fromEntries(rows.map((r) => [String(r.status), Number(r.n)]));
}
