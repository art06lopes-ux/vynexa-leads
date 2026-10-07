import "server-only";

import { agora, getBanco, novoId, planos } from "@/db/cliente";
import { comemorarVenda } from "@/services/financeiro";

/**
 * Vendas e cobranças — leitura para a tela de Pagamentos, e as escritas
 * que o checkout da Stripe (cartão, legado) ainda usa.
 */

export type VendaListada = {
  id: string;
  descricao: string;
  valor_centavos: number;
  moeda: string;
  status: "pendente" | "pago" | "vencido" | "cancelado" | "reembolsado";
  origem: string;
  meio_pagamento: string | null;
  cliente_nome: string | null;
  cliente_empresa: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  cliente_documento: string | null;
  lead_id: string | null;
  campanha_nome: string | null;
  produto_nome: string | null;
  criado_em: string;
  pago_em: string | null;
  cobranca_status: string | null;
  cobranca_link: string | null;
  cobranca_vencimento: string | null;
  cobranca_forma: string | null;
};

export async function listarVendas(limite = 100): Promise<VendaListada[]> {
  const { rows } = await getBanco().execute({
    sql: `SELECT v.id, v.descricao, v.valor_centavos, v.moeda, v.status, v.origem, v.meio_pagamento, v.cliente_nome, v.cliente_empresa,
                 v.cliente_email, v.cliente_telefone, v.cliente_documento, v.lead_id, c.nome campanha_nome, p.nome produto_nome,
                 v.criado_em, v.pago_em,
                 cb.status cobranca_status, cb.link_pagamento cobranca_link, cb.vencimento cobranca_vencimento, cb.forma cobranca_forma
          FROM vendas v
          LEFT JOIN campanhas c ON c.id = v.campanha_id
          LEFT JOIN produtos p ON p.id = v.produto_id
          LEFT JOIN cobrancas cb ON cb.id = (SELECT id FROM cobrancas WHERE venda_id = v.id ORDER BY criado_em DESC LIMIT 1)
          ORDER BY COALESCE(v.pago_em, v.criado_em) DESC LIMIT ?`,
    args: [limite],
  });
  return planos<VendaListada>(rows);
}

export type ResumoFinanceiro = {
  totalCentavos: number;
  mesCentavos: number;
  vendas: number;
  ticketCentavos: number;
  pendentesCentavos: number;
  pendentes: number;
  recebidosMes: number;
  vencidos: number;
  vencidosCentavos: number;
};

export async function resumoFinanceiro(): Promise<ResumoFinanceiro> {
  const { rows } = await getBanco().execute(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_centavos END), 0) total,
      COALESCE(SUM(CASE WHEN status = 'pago' AND pago_em >= date('now','start of month') THEN valor_centavos END), 0) mes,
      SUM(status = 'pago') vendas,
      COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor_centavos END), 0) pend_c,
      SUM(status = 'pendente') pend,
      SUM(status = 'pago' AND pago_em >= date('now','start of month')) rec_mes,
      SUM(status = 'vencido') venc,
      COALESCE(SUM(CASE WHEN status = 'vencido' THEN valor_centavos END), 0) venc_c
    FROM vendas`);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    totalCentavos: n("total"),
    mesCentavos: n("mes"),
    vendas: n("vendas"),
    ticketCentavos: n("vendas") > 0 ? Math.round(n("total") / n("vendas")) : 0,
    pendentesCentavos: n("pend_c"),
    pendentes: n("pend"),
    recebidosMes: n("rec_mes"),
    vencidos: n("venc"),
    vencidosCentavos: n("venc_c"),
  };
}

// ---------------------------------------------------------------------
// Stripe (checkout hospedado, cartão)
// ---------------------------------------------------------------------

export async function criarVendaPendente(entrada: {
  descricao: string;
  valorCentavos: number;
  moeda: string;
  leadId?: string | null;
  clienteEmail?: string | null;
  clienteNome?: string | null;
}): Promise<string> {
  const id = novoId();
  await getBanco().execute({
    sql: `INSERT INTO vendas (id, descricao, valor_centavos, moeda, status, origem, lead_id, cliente_email, cliente_nome)
          VALUES (?, ?, ?, ?, 'pendente', 'stripe', ?, ?, ?)`,
    args: [id, entrada.descricao, entrada.valorCentavos, entrada.moeda, entrada.leadId ?? null, entrada.clienteEmail ?? null, entrada.clienteNome ?? null],
  });
  return id;
}

export async function anexarSessaoStripe(vendaId: string, sessionId: string): Promise<void> {
  await getBanco().execute({ sql: `UPDATE vendas SET stripe_session_id = ? WHERE id = ?`, args: [sessionId, vendaId] });
}

/** Idempotente (`WHERE status <> 'pago'`); notifica só na primeira vez. */
export async function marcarComoPaga(
  vendaId: string,
  dados: { sessionId: string; paymentIntent: string | null; email: string | null; nome: string | null },
): Promise<boolean> {
  const banco = getBanco();
  const { rowsAffected } = await banco.execute({
    sql: `UPDATE vendas
          SET status = 'pago', pago_em = ?, meio_pagamento = 'cartao_stripe',
              stripe_session_id = COALESCE(stripe_session_id, ?), stripe_payment_intent = ?,
              cliente_email = COALESCE(?, cliente_email), cliente_nome = COALESCE(?, cliente_nome)
          WHERE id = ? AND status <> 'pago'`,
    args: [agora(), dados.sessionId, dados.paymentIntent, dados.email, dados.nome, vendaId],
  });
  if (rowsAffected > 0) await comemorarVenda(banco, vendaId);
  return rowsAffected > 0;
}
