import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { EtapaLead } from "@/db/tipos";
import { gerarProposta } from "@/integrations/ai/agentes/proposal-generator";
import { carimbosDaEtapa, ROTULO_ETAPA } from "@/services/crm";
import { eventoSql } from "@/services/eventos";
import { carregarCatalogo, carregarDados, carregarRemetente } from "@/services/inteligencia";

/** Ações do operador sobre um lead (perfil e CRM). */

export async function mudarEtapa(banco: Client, leadId: string, etapa: EtapaLead, motivo?: string | null): Promise<{ de: EtapaLead; para: EtapaLead }> {
  const { rows } = await banco.execute({ sql: `SELECT etapa FROM leads WHERE id = ?`, args: [leadId] });
  if (!rows[0]) throw new Error("Lead não encontrado.");
  const de = String(rows[0].etapa) as EtapaLead;
  if (de === etapa) return { de, para: etapa };

  const instante = agora();
  const carimbos = carimbosDaEtapa(etapa).map((c) => `${c} = COALESCE(${c}, ?)`);
  await banco.batch(
    [
      {
        sql: `UPDATE leads SET etapa = ?, etapa_em = ?, atualizado_em = ?, motivo_perda = ?${carimbos.length ? `, ${carimbos.join(", ")}` : ""} WHERE id = ?`,
        args: [etapa, instante, instante, etapa === "perdido" ? (motivo ?? null) : null, ...carimbos.map(() => instante), leadId],
      },
      eventoSql(leadId, "etapa_alterada", `${ROTULO_ETAPA[de]} → ${ROTULO_ETAPA[etapa]}${etapa === "perdido" && motivo ? ` (${motivo})` : ""}`, { de, para: etapa }),
    ],
    "write",
  );
  return { de, para: etapa };
}

export async function adicionarNota(banco: Client, leadId: string, texto: string): Promise<void> {
  await banco.execute(eventoSql(leadId, "nota", texto.slice(0, 2000)));
}

/**
 * Registro de contato feito fora do sistema (WhatsApp aberto, mensagem
 * copiada, ligação). O WhatsApp só ABRE a conversa — o envio é sempre
 * do operador, no próprio app — então "abrir" já conta como abordagem.
 */
export async function registrarContato(banco: Client, leadId: string, tipo: "whatsapp_aberto" | "mensagem_copiada" | "contato_registrado", detalhe?: string | null): Promise<void> {
  const instante = agora();
  const descricao = { whatsapp_aberto: "WhatsApp aberto com a mensagem pronta", mensagem_copiada: "Mensagem copiada", contato_registrado: "Contato registrado manualmente" }[tipo];
  const statements: InStatement[] = [eventoSql(leadId, tipo, detalhe ? `${descricao}: ${detalhe}` : descricao)];
  if (tipo !== "mensagem_copiada") {
    statements.push({
      sql: `UPDATE leads SET etapa = CASE WHEN etapa IN ('novo','qualificado') THEN 'abordado' ELSE etapa END,
                             etapa_em = CASE WHEN etapa IN ('novo','qualificado') THEN ? ELSE etapa_em END,
                             contatado_em = COALESCE(contatado_em, ?), atualizado_em = ? WHERE id = ?`,
      args: [instante, instante, instante, leadId],
    });
  }
  await banco.batch(statements, "write");
}

/** O lead respondeu: muda a etapa, marca o último e-mail e cancela follow-ups. */
export async function registrarResposta(banco: Client, leadId: string): Promise<void> {
  const instante = agora();
  await banco.batch(
    [
      {
        sql: `UPDATE leads SET etapa = CASE WHEN etapa IN ('novo','qualificado','abordado') THEN 'respondeu' ELSE etapa END,
                               etapa_em = CASE WHEN etapa IN ('novo','qualificado','abordado') THEN ? ELSE etapa_em END,
                               respondeu_em = COALESCE(respondeu_em, ?), contatado_em = COALESCE(contatado_em, ?), atualizado_em = ? WHERE id = ?`,
        args: [instante, instante, instante, instante, leadId],
      },
      {
        sql: `UPDATE envios SET status = 'respondeu', respondido_em = ?, atualizado_em = ?
              WHERE id = (SELECT id FROM envios WHERE lead_id = ? AND enviado_em IS NOT NULL ORDER BY enviado_em DESC LIMIT 1)`,
        args: [instante, instante, leadId],
      },
      {
        sql: `UPDATE envios SET status = 'cancelado', erro = 'Lead respondeu — follow-up cancelado', atualizado_em = ?
              WHERE lead_id = ? AND passo > 0 AND status IN ('pendente','preparado','agendado')`,
        args: [instante, leadId],
      },
      {
        sql: `UPDATE campanhas SET respostas = respostas + 1
              WHERE id = (SELECT campanha_id FROM envios WHERE lead_id = ? AND campanha_id IS NOT NULL ORDER BY enviado_em DESC LIMIT 1)`,
        args: [leadId],
      },
      eventoSql(leadId, "lead_respondeu", "Lead respondeu"),
    ],
    "write",
  );
}

export async function criarProposta(banco: Client, leadId: string, produtoId: string | null, valorCentavos: number | null): Promise<string> {
  const { dados, lead } = await carregarDados(banco, leadId);
  const remetente = await carregarRemetente(banco);
  const catalogo = await carregarCatalogo(banco);
  const idProduto = produtoId ?? lead.produto_sugerido_id;
  const produto = catalogo.find((p) => p.id === idProduto) ?? null;

  let entregaveis: string[] = [];
  if (produto) {
    const { rows } = await banco.execute({ sql: `SELECT entregaveis FROM produtos WHERE id = ?`, args: [produto.id] });
    entregaveis = String(rows[0]?.entregaveis ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const conteudo = await gerarProposta(dados, remetente, produto, entregaveis);
  const valor = valorCentavos ?? (produto && produto.preco_centavos > 0 ? produto.preco_centavos : null);
  const id = novoId();
  const instante = agora();
  await banco.batch(
    [
      {
        sql: `INSERT INTO propostas (id, lead_id, produto_id, titulo, conteudo, valor_centavos, status, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 'rascunho', ?, ?)`,
        args: [id, leadId, produto?.id ?? null, conteudo.titulo, JSON.stringify(conteudo), valor, instante, instante],
      },
      eventoSql(leadId, "proposta_gerada", `Proposta gerada: ${conteudo.titulo}`, { propostaId: id }),
    ],
    "write",
  );
  return id;
}

export async function mudarStatusProposta(banco: Client, propostaId: string, status: "rascunho" | "enviada" | "aceita" | "recusada"): Promise<void> {
  const { rows } = await banco.execute({ sql: `SELECT lead_id FROM propostas WHERE id = ?`, args: [propostaId] });
  const leadId = rows[0]?.lead_id ? String(rows[0].lead_id) : null;
  if (!leadId) throw new Error("Proposta não encontrada.");
  await banco.execute({ sql: `UPDATE propostas SET status = ?, atualizado_em = ? WHERE id = ?`, args: [status, agora(), propostaId] });
  if (status === "enviada") await mudarEtapa(banco, leadId, "proposta");
}

export async function editarContato(banco: Client, empresaId: string, campos: { telefone?: string | null; email?: string | null; instagram?: string | null; website?: string | null }): Promise<void> {
  const { abreWhatsapp } = await import("@/lib/leads/whatsapp");
  const { telefoneE164, normalizarEmail, dominioProprio } = await import("@/services/normalizacao");
  const { classificarStatusSite } = await import("@/lib/leads/classificacao");
  const { recalcularScores } = await import("@/services/registro");
  const { rows } = await banco.execute({ sql: `SELECT * FROM empresas WHERE id = ?`, args: [empresaId] });
  const e = rows[0];
  if (!e) throw new Error("Empresa não encontrada.");

  const telefone = campos.telefone === undefined ? (e.telefone as string | null) : campos.telefone?.trim() || null;
  const email = campos.email === undefined ? (e.email as string | null) : normalizarEmail(campos.email);
  if (campos.email && !email) throw new Error("E-mail inválido.");
  const instagram = campos.instagram === undefined ? (e.instagram as string | null) : campos.instagram?.trim() || null;
  const website = campos.website === undefined ? (e.website as string | null) : campos.website?.trim() || null;
  const pais = String(e.pais);

  await banco.execute({
    sql: `UPDATE empresas SET telefone = ?, telefone_e164 = ?, telefone_origem = CASE WHEN ? IS NULL THEN NULL WHEN telefone IS ? THEN telefone_origem ELSE 'manual' END,
                              telefone_manual = CASE WHEN telefone IS ? THEN telefone_manual ELSE 1 END, whatsapp = ?,
                              email = ?, email_origem = CASE WHEN ? IS NULL THEN NULL WHEN email IS ? THEN email_origem ELSE 'manual' END,
                              instagram = ?, website = ?, dominio = ?, status_site = ?,
                              site_avaliado_em = CASE WHEN website IS ? THEN site_avaliado_em ELSE NULL END,
                              site_qualidade = CASE WHEN website IS ? THEN site_qualidade ELSE NULL END,
                              atualizado_em = ? WHERE id = ?`,
    args: [
      telefone, telefoneE164(telefone, pais), telefone, telefone, telefone, abreWhatsapp(telefone, pais),
      email, email, email, instagram, website, dominioProprio(website),
      classificarStatusSite({ website, telefone, email, instagram, facebook: e.facebook as string | null }),
      website, website, agora(), empresaId,
    ],
  });
  await recalcularScores(banco, [empresaId]);
}
