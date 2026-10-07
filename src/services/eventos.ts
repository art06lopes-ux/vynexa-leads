import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { TipoEvento } from "@/db/tipos";

/**
 * Histórico do lead. Toda ação que muda o lead — achado, analisado,
 * mensagem gerada, WhatsApp aberto, e-mail enviado, etapa trocada, venda —
 * deixa uma linha aqui. É o que a linha do tempo do perfil mostra.
 */

export function eventoSql(leadId: string, tipo: TipoEvento, descricao: string, dados?: unknown): InStatement {
  return {
    sql: `INSERT INTO eventos (id, lead_id, tipo, descricao, dados, criado_em) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [novoId(), leadId, tipo, descricao.slice(0, 500), dados === undefined ? null : JSON.stringify(dados), agora()],
  };
}

export async function registrarEvento(banco: Client, leadId: string, tipo: TipoEvento, descricao: string, dados?: unknown): Promise<void> {
  await banco.execute(eventoSql(leadId, tipo, descricao, dados));
}

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  lead_encontrado: "Lead encontrado",
  ia_analisou: "IA analisou",
  mensagem_gerada: "Mensagem gerada",
  whatsapp_aberto: "WhatsApp aberto",
  mensagem_copiada: "Mensagem copiada",
  email_enviado: "E-mail enviado",
  email_aberto: "E-mail aberto",
  email_clicado: "Link clicado",
  lead_respondeu: "Lead respondeu",
  etapa_alterada: "Etapa alterada",
  nota: "Nota",
  contato_registrado: "Contato registrado",
  proposta_gerada: "Proposta gerada",
  venda_registrada: "Venda registrada",
  cobranca_criada: "Cobrança criada",
  pagamento_confirmado: "Pagamento confirmado",
  adicionado_campanha: "Adicionado a campanha",
  nao_contatar: "Não contatar",
  site_avaliado: "Site avaliado",
};
