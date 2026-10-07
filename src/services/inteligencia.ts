import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Empresa, Lead, MotivoScore, TipoMensagem } from "@/db/tipos";
import type { DadosLead, ProdutoCatalogo, Remetente } from "@/integrations/ai/agentes/contexto";
import { gerarEmail, type EmailGerado } from "@/integrations/ai/agentes/email-generator";
import { analisarLead, type AnaliseLead } from "@/integrations/ai/agentes/lead-analyzer";
import { gerarMensagens, type VersoesMensagem } from "@/integrations/ai/agentes/message-generator";
import { analisarOportunidade, type OportunidadeVenda } from "@/integrations/ai/agentes/sales-opportunity-analyzer";
import { decidirCanal } from "@/lib/ia/analise";
import { eventoSql } from "@/services/eventos";

/**
 * Inteligência do lead: monta o contexto, chama os agentes e grava.
 *
 * Usado pelo perfil do lead ("Analisar com IA", "Gerar abordagem"), pelo
 * modo em massa e pelo worker. Os agentes não tocam no banco; este
 * módulo é a ponte.
 */

export type AnaliseCompleta = AnaliseLead & { oportunidade: OportunidadeVenda };

export async function carregarDados(banco: Client, leadId: string): Promise<{ dados: DadosLead; lead: Lead; empresa: Empresa }> {
  const { rows: lr } = await banco.execute({ sql: `SELECT * FROM leads WHERE id = ?`, args: [leadId] });
  if (!lr[0]) throw new Error("Lead não encontrado.");
  const lead = { ...(lr[0] as unknown as Lead) };
  const { rows: er } = await banco.execute({ sql: `SELECT * FROM empresas WHERE id = ?`, args: [lead.empresa_id] });
  const empresa = { ...(er[0] as unknown as Empresa) };

  let problemasSite: string[] = [];
  try {
    problemasSite = empresa.site_sinais ? ((JSON.parse(empresa.site_sinais) as { problemas?: string[] }).problemas ?? []) : [];
  } catch {
    problemasSite = [];
  }
  let motivos: MotivoScore[] = [];
  try {
    motivos = lead.score_motivos ? (JSON.parse(lead.score_motivos) as MotivoScore[]) : [];
  } catch {
    motivos = [];
  }

  return {
    lead,
    empresa,
    dados: { empresa, motivosScore: motivos, score: lead.score_oportunidade, problemasSite, diagnostico: lead.motivo_problema },
  };
}

export async function carregarRemetente(banco: Client): Promise<Remetente> {
  const { rows } = await banco.execute(`SELECT chave, valor FROM configuracoes`);
  const c = Object.fromEntries(rows.map((r) => [String(r.chave), String(r.valor)]));
  return {
    nome: c.responsavel_nome || c.remetente_nome || "Artur",
    empresa: c.empresa_nome || "Vynexa Dev",
    site: c.empresa_site || null,
    whatsapp: c.empresa_whatsapp || null,
    instagram: c.empresa_instagram || null,
    assinatura: c.email_assinatura || null,
  };
}

export async function carregarCatalogo(banco: Client): Promise<ProdutoCatalogo[]> {
  const { rows } = await banco.execute(
    `SELECT id, nome, tipo, descricao, preco_centavos, moeda FROM produtos WHERE ativo = 1 ORDER BY ordem, nome`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    tipo: r.tipo ? String(r.tipo) : null,
    descricao: r.descricao ? String(r.descricao) : null,
    preco_centavos: Number(r.preco_centavos),
    moeda: String(r.moeda),
  }));
}

/** LeadAnalyzer + SalesOpportunityAnalyzer, gravados no lead. */
export async function analisarEGravar(banco: Client, leadId: string): Promise<AnaliseCompleta> {
  const { dados, lead, empresa } = await carregarDados(banco, leadId);
  const catalogo = await carregarCatalogo(banco);

  const analise = await analisarLead(dados);
  const oportunidade = await analisarOportunidade({ ...dados, diagnostico: analise.diagnostico }, catalogo);
  const completa: AnaliseCompleta = { ...analise, oportunidade };

  const instante = agora();
  // Prioridade alta num lead novo o qualifica — é a definição de "vale
  // abordar". Os demais ficam onde estão: a IA não move lead para trás.
  const qualifica = lead.etapa === "novo" && analise.prioridade === "alta";
  const statements: InStatement[] = [
    {
      sql: `UPDATE leads SET analise = ?, motivo_problema = ?, prioridade = ?, solucao_sugerida = ?, produto_sugerido_id = ?,
                             canal_recomendado = ?, analisado_em = ?, atualizado_em = ?,
                             etapa = CASE WHEN ? THEN 'qualificado' ELSE etapa END,
                             etapa_em = CASE WHEN ? THEN ? ELSE etapa_em END
            WHERE id = ?`,
      args: [
        JSON.stringify(completa), analise.diagnostico, analise.prioridade, oportunidade.solucao, oportunidade.produtoId,
        decidirCanal(empresa), instante, instante, qualifica ? 1 : 0, qualifica ? 1 : 0, instante, leadId,
      ],
    },
    eventoSql(leadId, "ia_analisou", `IA analisou: prioridade ${analise.prioridade}, solução sugerida ${oportunidade.solucao}`),
  ];
  if (qualifica) statements.push(eventoSql(leadId, "etapa_alterada", "Novo → Qualificado (prioridade alta na análise)"));
  await banco.batch(statements, "write");
  return completa;
}

function argumentoSalvo(lead: Lead): { argumento: string | null; cta: string | null } {
  try {
    const a = lead.analise ? (JSON.parse(lead.analise) as AnaliseCompleta) : null;
    return { argumento: a?.oportunidade?.argumento ?? null, cta: a?.oportunidade?.cta ?? null };
  } catch {
    return { argumento: null, cta: null };
  }
}

/** MessageGenerator + EmailGenerator: todas as versões, gravadas em `mensagens`. */
export async function gerarAbordagens(banco: Client, leadId: string): Promise<{ versoes: VersoesMensagem; email: EmailGerado | null }> {
  const { dados, lead, empresa } = await carregarDados(banco, leadId);
  const remetente = await carregarRemetente(banco);
  const { argumento, cta } = argumentoSalvo(lead);

  const versoes = await gerarMensagens(dados, remetente, argumento);
  // O e-mail é gerado mesmo sem endereço conhecido: o operador pode ter
  // o contato por fora e só precisar do texto.
  const email: EmailGerado | null = await gerarEmail(dados, remetente, argumento, cta);

  const instante = agora();
  const idioma = empresa.idioma_abordagem;
  const linha = (tipo: TipoMensagem, corpo: string, assunto: string | null = null): InStatement => ({
    sql: `INSERT INTO mensagens (id, lead_id, tipo, assunto, corpo, idioma, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [novoId(), leadId, tipo, assunto, corpo, idioma, instante],
  });

  const statements: InStatement[] = [
    linha("curta", versoes.curta),
    linha("profissional", versoes.profissional),
    linha("informal", versoes.informal),
    linha("whatsapp", versoes.whatsapp),
    linha("instagram", versoes.instagram),
    {
      sql: `UPDATE leads SET mensagem_gerada = ?, atualizado_em = ? WHERE id = ?`,
      args: [empresa.whatsapp === 1 ? versoes.whatsapp : versoes.profissional, instante, leadId],
    },
    eventoSql(leadId, "mensagem_gerada", "Mensagens de abordagem geradas pela IA"),
  ];
  if (email) statements.push(linha("email", email.corpo, email.assunto));
  await banco.batch(statements, "write");
  return { versoes, email };
}
