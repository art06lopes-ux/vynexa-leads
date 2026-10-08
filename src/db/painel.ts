import "server-only";

import { getBanco, planos } from "@/db/cliente";
import { CONDICAO_NAO_ABORDADO } from "@/db/para-abordar";
import type { EtapaLead } from "@/db/tipos";
import { ETAPAS } from "@/services/crm";

/**
 * Números do painel. Tudo calculado de linhas reais — nenhum valor de
 * exemplo. Banco vazio dá zero, e a interface mostra o estado vazio.
 */

export async function contadoresNav(): Promise<Record<string, number>> {
  const banco = getBanco();
  const [{ rows }, { rows: n }] = await Promise.all([
    banco.execute(`
      SELECT
        (SELECT COUNT(*) FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE ${CONDICAO_NAO_ABORDADO}) AS leads,
        (SELECT COUNT(*) FROM leads WHERE prioridade = 'alta' AND etapa IN ('novo','qualificado')) AS oportunidades,
        (SELECT COUNT(*) FROM campanhas WHERE status IN ('preparando','pronta','agendada','enviando')) AS campanhas,
        (SELECT COUNT(*) FROM envios WHERE status = 'erro') AS emails,
        (SELECT COUNT(*) FROM leads WHERE etapa IN ('respondeu','negociacao','proposta')) AS crm,
        (SELECT COUNT(*) FROM vendas WHERE status IN ('pendente','vencido')) AS pagamentos
    `),
    banco.execute(`SELECT COUNT(*) AS n FROM notificacoes WHERE lida_em IS NULL`),
  ]);
  const r = rows[0] ?? {};
  return {
    leads: Number(r.leads ?? 0),
    oportunidades: Number(r.oportunidades ?? 0),
    campanhas: Number(r.campanhas ?? 0),
    emails: Number(r.emails ?? 0),
    crm: Number(r.crm ?? 0),
    pagamentos: Number(r.pagamentos ?? 0),
    notificacoes: Number(n[0]?.n ?? 0),
  };
}

export type Kpis = {
  receitaMesCentavos: number;
  receitaMesAnteriorCentavos: number;
  receitaTotalCentavos: number;
  leads: number;
  leadsMes: number;
  qualificados: number;
  contatados: number;
  respostas: number;
  propostas: number;
  vendas: number;
  conversao: number | null;
  semSite: number;
  oportunidadesAltas: number;
  /** Ainda não abordados (filtro "Situação: não abordados" de Leads). */
  paraAbordar: number;
  campanhasAtivas: number;
  emailsEnviados: number;
};

export async function obterKpis(): Promise<Kpis> {
  const { rows } = await getBanco().execute(`
    SELECT
      (SELECT COALESCE(SUM(valor_centavos),0) FROM vendas WHERE status = 'pago' AND pago_em >= date('now','start of month')) AS receita_mes,
      (SELECT COALESCE(SUM(valor_centavos),0) FROM vendas WHERE status = 'pago' AND pago_em >= date('now','start of month','-1 month') AND pago_em < date('now','start of month')) AS receita_ant,
      (SELECT COALESCE(SUM(valor_centavos),0) FROM vendas WHERE status = 'pago') AS receita_total,
      (SELECT COUNT(*) FROM leads) AS leads,
      (SELECT COUNT(*) FROM leads WHERE criado_em >= date('now','start of month')) AS leads_mes,
      (SELECT COUNT(*) FROM leads WHERE etapa <> 'novo' OR prioridade = 'alta') AS qualificados,
      (SELECT COUNT(*) FROM leads WHERE contatado_em IS NOT NULL OR etapa IN ('abordado','respondeu','negociacao','proposta','fechado')) AS contatados,
      (SELECT COUNT(*) FROM leads WHERE respondeu_em IS NOT NULL OR etapa IN ('respondeu','negociacao','proposta','fechado')) AS respostas,
      (SELECT COUNT(*) FROM leads WHERE etapa IN ('proposta','fechado')) AS propostas,
      (SELECT COUNT(*) FROM vendas WHERE status = 'pago') AS vendas,
      (SELECT COUNT(*) FROM empresas WHERE status_site IN ('sem_site','rede_social')) AS sem_site,
      (SELECT COUNT(*) FROM leads WHERE prioridade = 'alta' AND etapa IN ('novo','qualificado')) AS altas,
      (SELECT COUNT(*) FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE ${CONDICAO_NAO_ABORDADO}) AS para_abordar,
      (SELECT COUNT(*) FROM campanhas WHERE status IN ('agendada','enviando')) AS camp,
      (SELECT COUNT(*) FROM envios WHERE enviado_em IS NOT NULL) AS enviados
  `);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  const contatados = n("contatados");
  return {
    receitaMesCentavos: n("receita_mes"),
    receitaMesAnteriorCentavos: n("receita_ant"),
    receitaTotalCentavos: n("receita_total"),
    leads: n("leads"),
    leadsMes: n("leads_mes"),
    qualificados: n("qualificados"),
    contatados,
    respostas: n("respostas"),
    propostas: n("propostas"),
    vendas: n("vendas"),
    conversao: contatados > 0 ? Math.round((n("vendas") / contatados) * 1000) / 10 : null,
    semSite: n("sem_site"),
    oportunidadesAltas: n("altas"),
    paraAbordar: n("para_abordar"),
    campanhasAtivas: n("camp"),
    emailsEnviados: n("enviados"),
  };
}

export type PontoDia = { dia: string; valor: number };

/** Série diária completa (dias sem dado entram como zero). */
function preencherDias(linhas: Array<{ dia: string; valor: number }>, dias: number): PontoDia[] {
  const mapa = new Map(linhas.map((l) => [l.dia, l.valor]));
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (dias - 1 - i));
    const chave = d.toISOString().slice(0, 10);
    return { dia: chave, valor: mapa.get(chave) ?? 0 };
  });
}

export async function serieDiaria(
  metrica: "leads" | "contatos" | "respostas" | "vendas" | "receita" | "sem_site",
  dias = 30,
): Promise<PontoDia[]> {
  const sql = {
    leads: `SELECT date(criado_em) dia, COUNT(*) valor FROM leads WHERE criado_em >= date('now', ?) GROUP BY dia`,
    sem_site: `SELECT date(criado_em) dia, COUNT(*) valor FROM empresas WHERE status_site IN ('sem_site','rede_social') AND criado_em >= date('now', ?) GROUP BY dia`,
    contatos: `SELECT date(contatado_em) dia, COUNT(*) valor FROM leads WHERE contatado_em >= date('now', ?) GROUP BY dia`,
    respostas: `SELECT date(respondeu_em) dia, COUNT(*) valor FROM leads WHERE respondeu_em >= date('now', ?) GROUP BY dia`,
    vendas: `SELECT date(pago_em) dia, COUNT(*) valor FROM vendas WHERE status = 'pago' AND pago_em >= date('now', ?) GROUP BY dia`,
    receita: `SELECT date(pago_em) dia, SUM(valor_centavos) valor FROM vendas WHERE status = 'pago' AND pago_em >= date('now', ?) GROUP BY dia`,
  }[metrica];
  const { rows } = await getBanco().execute({ sql, args: [`-${dias - 1} days`] });
  return preencherDias(rows.map((r) => ({ dia: String(r.dia), valor: Number(r.valor) })), dias);
}

export type PontoMes = { mes: string; receita: number; vendas: number; leads: number; contatos: number };

/** Últimos N meses, com rótulo AAAA-MM. */
export async function serieMensal(meses = 6): Promise<PontoMes[]> {
  const banco = getBanco();
  const desde = `-${meses - 1} months`;
  const [rec, lea, con] = await Promise.all([
    banco.execute({
      sql: `SELECT strftime('%Y-%m', pago_em) mes, SUM(valor_centavos) receita, COUNT(*) vendas FROM vendas WHERE status = 'pago' AND pago_em >= date('now','start of month', ?) GROUP BY mes`,
      args: [desde],
    }),
    banco.execute({ sql: `SELECT strftime('%Y-%m', criado_em) mes, COUNT(*) n FROM leads WHERE criado_em >= date('now','start of month', ?) GROUP BY mes`, args: [desde] }),
    banco.execute({ sql: `SELECT strftime('%Y-%m', contatado_em) mes, COUNT(*) n FROM leads WHERE contatado_em >= date('now','start of month', ?) GROUP BY mes`, args: [desde] }),
  ]);
  const m = (rows: Array<Record<string, unknown>>, campo: string) => new Map(rows.map((r) => [String(r.mes), Number(r[campo] ?? 0)]));
  const receita = m(rec.rows, "receita");
  const vendas = m(rec.rows, "vendas");
  const leads = m(lea.rows, "n");
  const contatos = m(con.rows, "n");
  return Array.from({ length: meses }, (_, i) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (meses - 1 - i));
    const chave = d.toISOString().slice(0, 7);
    return { mes: chave, receita: receita.get(chave) ?? 0, vendas: vendas.get(chave) ?? 0, leads: leads.get(chave) ?? 0, contatos: contatos.get(chave) ?? 0 };
  });
}

export async function porEtapa(): Promise<Record<EtapaLead, number>> {
  const { rows } = await getBanco().execute(`SELECT etapa, COUNT(*) n FROM leads GROUP BY etapa`);
  const r = Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<EtapaLead, number>;
  for (const l of rows) if (String(l.etapa) in r) r[String(l.etapa) as EtapaLead] = Number(l.n);
  return r;
}

export async function porCategoria(limite = 8): Promise<Array<{ rotulo: string; total: number; semSite: number }>> {
  const { rows } = await getBanco().execute({
    sql: `SELECT COALESCE(categoria_rotulo, categoria) rotulo, COUNT(*) total, SUM(status_site IN ('sem_site','rede_social')) sem_site
          FROM empresas GROUP BY rotulo ORDER BY total DESC LIMIT ?`,
    args: [limite],
  });
  return rows.map((r) => ({ rotulo: String(r.rotulo), total: Number(r.total), semSite: Number(r.sem_site ?? 0) }));
}

export async function porPais(limite = 8): Promise<Array<{ pais: string; total: number }>> {
  const { rows } = await getBanco().execute({ sql: `SELECT pais, COUNT(*) total FROM empresas GROUP BY pais ORDER BY total DESC LIMIT ?`, args: [limite] });
  return rows.map((r) => ({ pais: String(r.pais), total: Number(r.total) }));
}

export type LeadTop = { lead_id: string; nome: string; cidade: string | null; categoria: string; score: number; prioridade: string | null; status_site: string; site_qualidade: string | null; avaliacao_qtd: number | null; avaliacao_nota: number | null; whatsapp: number | null };

export async function melhoresOportunidades(limite = 6): Promise<LeadTop[]> {
  const { rows } = await getBanco().execute({
    sql: `SELECT l.id lead_id, e.nome, e.cidade, COALESCE(e.categoria_rotulo, e.categoria) categoria, l.score_oportunidade score, l.prioridade,
                 e.status_site, e.site_qualidade, e.avaliacao_qtd, e.avaliacao_nota, e.whatsapp
          FROM leads l JOIN empresas e ON e.id = l.empresa_id
          WHERE ${CONDICAO_NAO_ABORDADO} AND l.score_oportunidade IS NOT NULL
          ORDER BY l.score_oportunidade DESC, e.avaliacao_qtd DESC NULLS LAST LIMIT ?`,
    args: [limite],
  });
  return planos<LeadTop>(rows);
}

export async function atividadeRecente(limite = 8): Promise<Array<{ id: string; tipo: string; descricao: string; criado_em: string; lead_id: string; nome: string }>> {
  const { rows } = await getBanco().execute({
    sql: `SELECT ev.id, ev.tipo, ev.descricao, ev.criado_em, ev.lead_id, e.nome
          FROM eventos ev JOIN leads l ON l.id = ev.lead_id JOIN empresas e ON e.id = l.empresa_id
          WHERE ev.tipo <> 'lead_encontrado'
          ORDER BY ev.criado_em DESC LIMIT ?`,
    args: [limite],
  });
  return planos(rows);
}

/**
 * Abordados há 3 dias ou mais que ainda não responderam: é quem vale uma
 * segunda mensagem antes de esfriar de vez.
 */
export async function paraRetomar(limite = 5): Promise<Array<{ lead_id: string; nome: string; cidade: string | null; contatado_em: string }>> {
  const { rows } = await getBanco().execute({
    sql: `SELECT l.id AS lead_id, e.nome, e.cidade, l.contatado_em
          FROM leads l JOIN empresas e ON e.id = l.empresa_id
          WHERE l.etapa = 'abordado' AND l.respondeu_em IS NULL AND e.nao_contatar = 0
            AND l.contatado_em IS NOT NULL AND l.contatado_em <= datetime('now', '-3 days')
          ORDER BY l.contatado_em ASC
          LIMIT ?`,
    args: [limite],
  });
  return planos(rows);
}

export async function buscasRecentes(limite = 6): Promise<Array<{ id: string; segmento: string; cidade: string | null; pais: string; provedor: string; status: string; quantidade_encontrada: number; quantidade_nova: number; criado_em: string; consulta_natural: string | null }>> {
  const { rows } = await getBanco().execute({
    sql: `SELECT id, segmento, cidade, pais, provedor, status, quantidade_encontrada, quantidade_nova, criado_em, consulta_natural FROM buscas ORDER BY criado_em DESC LIMIT ?`,
    args: [limite],
  });
  return planos(rows);
}

export async function lerIdentidade(): Promise<{ empresa: string; responsavel: string; logoUrl: string | null; config: Record<string, string> }> {
  const { rows } = await getBanco().execute(`SELECT chave, valor, atualizado_em FROM configuracoes`);
  const c: Record<string, string> = {};
  let versaoLogo = "";
  for (const r of rows) {
    c[String(r.chave)] = String(r.valor);
    if (r.chave === "logo_data") versaoLogo = String(r.atualizado_em).replace(/\D/g, "");
  }
  return {
    empresa: c.empresa_nome || "Vynexa Dev",
    responsavel: c.responsavel_nome || c.remetente_nome || "Artur",
    logoUrl: c.logo_data ? `/api/marca/logo?v=${versaoLogo}` : null,
    config: c,
  };
}
