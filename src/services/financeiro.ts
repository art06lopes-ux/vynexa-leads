import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import { notificar } from "@/integrations/notificacoes";
import { obterPagamentos, type FormaCobranca } from "@/integrations/pagamentos/asaas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { eventoSql } from "@/services/eventos";
import { interpretarEventoAsaas, type EventoAsaas } from "@/services/pagamentos";

/**
 * Vendas, cobranças e o webhook de pagamento.
 *
 * Fluxo: o lead chega a "fechado" → `registrarVenda` (pendente ou já
 * paga) → opcionalmente `emitirCobranca` no Asaas → o Asaas avisa por
 * webhook → `processarWebhookAsaas` marca a venda como paga UMA vez e
 * dispara a notificação de venda.
 */

export type NovaVenda = {
  leadId: string | null;
  produtoId: string | null;
  descricao: string;
  valorCentavos: number;
  moeda: string;
  meioPagamento: string | null;
  pago: boolean;
  cliente: { nome: string | null; empresa: string | null; email: string | null; telefone: string | null; documento: string | null };
};

/** Dados que a notificação de venda (toast + central) mostra. */
export type DadosVenda = {
  vendaId: string;
  cliente: string | null;
  empresa: string | null;
  servico: string;
  valorCentavos: number;
  moeda: string;
  meio: string | null;
  data: string;
};

export async function registrarVenda(banco: Client, v: NovaVenda): Promise<string> {
  const id = novoId();
  const instante = agora();

  // Campanha de origem: a última campanha que mandou e-mail para o lead.
  let campanhaId: string | null = null;
  if (v.leadId) {
    const { rows } = await banco.execute({
      sql: `SELECT campanha_id FROM envios WHERE lead_id = ? AND campanha_id IS NOT NULL AND enviado_em IS NOT NULL ORDER BY enviado_em DESC LIMIT 1`,
      args: [v.leadId],
    });
    campanhaId = rows[0]?.campanha_id ? String(rows[0].campanha_id) : null;
  }

  const statements: InStatement[] = [
    {
      sql: `INSERT INTO vendas (id, produto_id, lead_id, campanha_id, descricao, valor_centavos, moeda, status, origem, meio_pagamento,
                                cliente_nome, cliente_empresa, cliente_email, cliente_telefone, cliente_documento, criado_em, pago_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, v.produtoId, v.leadId, campanhaId, v.descricao, v.valorCentavos, v.moeda, v.pago ? "pago" : "pendente", v.meioPagamento,
        v.cliente.nome, v.cliente.empresa, v.cliente.email, v.cliente.telefone, v.cliente.documento?.replace(/\D/g, "") || null,
        instante, v.pago ? instante : null,
      ],
    },
  ];

  if (v.leadId) {
    statements.push(
      {
        sql: `UPDATE leads SET etapa = 'fechado', etapa_em = ?, atualizado_em = ? WHERE id = ? AND etapa <> 'fechado'`,
        args: [instante, instante, v.leadId],
      },
      eventoSql(v.leadId, "venda_registrada", `Venda registrada: ${v.descricao} — ${formatarDinheiro(v.valorCentavos, v.moeda)}`, { vendaId: id }),
    );
  }
  await banco.batch(statements, "write");

  if (v.pago) await comemorarVenda(banco, id);
  return id;
}

async function dadosDaVenda(banco: Client, vendaId: string): Promise<DadosVenda | null> {
  const { rows } = await banco.execute({
    sql: `SELECT v.id, v.descricao, v.valor_centavos, v.moeda, v.meio_pagamento, v.cliente_nome, v.cliente_empresa, v.pago_em,
                 p.nome AS produto, e.nome AS empresa_lead
          FROM vendas v
          LEFT JOIN produtos p ON p.id = v.produto_id
          LEFT JOIN leads l ON l.id = v.lead_id
          LEFT JOIN empresas e ON e.id = l.empresa_id
          WHERE v.id = ?`,
    args: [vendaId],
  });
  const r = rows[0];
  if (!r) return null;
  return {
    vendaId,
    cliente: r.cliente_nome ? String(r.cliente_nome) : null,
    empresa: r.cliente_empresa ? String(r.cliente_empresa) : r.empresa_lead ? String(r.empresa_lead) : null,
    servico: r.produto ? String(r.produto) : String(r.descricao),
    valorCentavos: Number(r.valor_centavos),
    moeda: String(r.moeda),
    meio: r.meio_pagamento ? String(r.meio_pagamento) : null,
    data: String(r.pago_em ?? agora()),
  };
}

/** A notificação de venda — com os dados que o toast mostra. */
export async function comemorarVenda(banco: Client, vendaId: string): Promise<void> {
  const d = await dadosDaVenda(banco, vendaId);
  if (!d) return;
  await notificar(banco, {
    tipo: "venda",
    titulo: "Nova venda!",
    corpo: `${d.empresa ?? d.cliente ?? "Cliente"} · ${d.servico} · ${formatarDinheiro(d.valorCentavos, d.moeda)}`,
    link: "/pagamentos",
    dados: d as unknown as Record<string, unknown>,
  });
}

/** Marca uma venda pendente como paga, à mão (Pix direto, dinheiro…). */
export async function confirmarPagamentoManual(banco: Client, vendaId: string, meio: string): Promise<boolean> {
  const instante = agora();
  const { rowsAffected } = await banco.execute({
    sql: `UPDATE vendas SET status = 'pago', pago_em = ?, meio_pagamento = COALESCE(?, meio_pagamento) WHERE id = ? AND status <> 'pago'`,
    args: [instante, meio, vendaId],
  });
  if (rowsAffected > 0) {
    const { rows } = await banco.execute({ sql: `SELECT lead_id FROM vendas WHERE id = ?`, args: [vendaId] });
    if (rows[0]?.lead_id) await banco.execute(eventoSql(String(rows[0].lead_id), "pagamento_confirmado", "Pagamento confirmado manualmente"));
    await comemorarVenda(banco, vendaId);
  }
  return rowsAffected > 0;
}

export async function emitirCobranca(
  banco: Client,
  entrada: { vendaId: string; forma: FormaCobranca; vencimento: string; documento: string; email: string | null; telefone: string | null; nome: string },
): Promise<{ cobrancaId: string; link: string | null }> {
  const { rows } = await banco.execute({ sql: `SELECT * FROM vendas WHERE id = ?`, args: [entrada.vendaId] });
  const venda = rows[0];
  if (!venda) throw new Error("Venda não encontrada.");
  if (venda.status === "pago") throw new Error("Esta venda já está paga.");

  const criada = await obterPagamentos().criarCobranca({
    cliente: { nome: entrada.nome, documento: entrada.documento, email: entrada.email, telefone: entrada.telefone },
    valorCentavos: Number(venda.valor_centavos),
    vencimento: entrada.vencimento,
    descricao: String(venda.descricao),
    forma: entrada.forma,
    referencia: entrada.vendaId,
  });

  const id = novoId();
  const instante = agora();
  const statements: InStatement[] = [
    {
      sql: `INSERT INTO cobrancas (id, venda_id, provedor, externo_id, cliente_externo_id, status, forma, valor_centavos, vencimento, link_pagamento, criado_em, atualizado_em)
            VALUES (?, ?, 'asaas', ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)`,
      args: [id, entrada.vendaId, criada.externoId, criada.clienteExternoId, entrada.forma, Number(venda.valor_centavos), entrada.vencimento, criada.link, instante, instante],
    },
    {
      sql: `UPDATE vendas SET origem = 'asaas', cliente_nome = COALESCE(cliente_nome, ?), cliente_documento = ?, cliente_email = COALESCE(cliente_email, ?) WHERE id = ?`,
      args: [entrada.nome, entrada.documento.replace(/\D/g, ""), entrada.email, entrada.vendaId],
    },
  ];
  if (venda.lead_id) {
    statements.push(eventoSql(String(venda.lead_id), "cobranca_criada", `Cobrança emitida no Asaas (${entrada.forma}) — vence ${entrada.vencimento}`, { cobrancaId: id }));
  }
  await banco.batch(statements, "write");
  return { cobrancaId: id, link: criada.link };
}

export type ResultadoWebhook = { duplicado: boolean; ignorado: boolean; vendaPaga: boolean };

/**
 * Processa um evento do Asaas. Idempotente: o mesmo `evento.id` só é
 * aplicado uma vez (UNIQUE em `webhook_eventos`), e a venda só vira
 * "paga" — e só comemora — na primeira confirmação.
 */
export async function processarWebhookAsaas(banco: Client, evento: EventoAsaas, bruto: string): Promise<ResultadoWebhook> {
  const eventoId = evento.id ?? `${evento.event}:${evento.payment?.id}:${evento.payment?.status}`;
  const { rowsAffected } = await banco.execute({
    sql: `INSERT OR IGNORE INTO webhook_eventos (id, provedor, evento_id, tipo, payload, recebido_em) VALUES (?, 'asaas', ?, ?, ?, ?)`,
    args: [novoId(), eventoId, evento.event ?? "desconhecido", bruto.slice(0, 20_000), agora()],
  });
  if (rowsAffected === 0) return { duplicado: true, ignorado: false, vendaPaga: false };

  const interpretacao = interpretarEventoAsaas(evento);
  const pagamentoId = evento.payment?.id;
  if (!interpretacao || !pagamentoId) {
    await marcarProcessado(banco, eventoId, null);
    return { duplicado: false, ignorado: true, vendaPaga: false };
  }

  // A cobrança pode ter sido criada direto no painel do Asaas, com o id da
  // venda em `externalReference`. Sem cobrança e sem referência, não há o
  // que atualizar aqui — o evento fica registrado para conferência.
  const { rows } = await banco.execute({
    sql: `SELECT id, venda_id FROM cobrancas WHERE provedor = 'asaas' AND externo_id = ?`,
    args: [pagamentoId],
  });
  let vendaId = rows[0]?.venda_id ? String(rows[0].venda_id) : null;
  if (!vendaId && evento.payment?.externalReference) {
    const { rows: v } = await banco.execute({ sql: `SELECT id FROM vendas WHERE id = ?`, args: [evento.payment.externalReference] });
    vendaId = v[0]?.id ? String(v[0].id) : null;
    if (vendaId) {
      await banco.execute({
        sql: `INSERT OR IGNORE INTO cobrancas (id, venda_id, provedor, externo_id, status, forma, valor_centavos, link_pagamento, criado_em, atualizado_em)
              VALUES (?, ?, 'asaas', ?, 'pendente', ?, ?, ?, ?, ?)`,
        args: [novoId(), vendaId, pagamentoId, evento.payment.billingType ?? null, Math.round((evento.payment.value ?? 0) * 100), evento.payment.invoiceUrl ?? null, agora(), agora()],
      });
    }
  }
  if (!vendaId) {
    await marcarProcessado(banco, eventoId, "Cobrança desconhecida (sem venda correspondente).");
    return { duplicado: false, ignorado: true, vendaPaga: false };
  }

  const instante = agora();
  await banco.execute({
    sql: `UPDATE cobrancas SET status = ?, atualizado_em = ? WHERE provedor = 'asaas' AND externo_id = ?`,
    args: [interpretacao.statusCobranca, instante, pagamentoId],
  });

  let vendaPaga = false;
  if (interpretacao.pago) {
    const meio = { PIX: "pix", BOLETO: "boleto", CREDIT_CARD: "cartao" }[evento.payment?.billingType ?? ""] ?? "outro";
    const { rowsAffected: mudou } = await banco.execute({
      sql: `UPDATE vendas SET status = 'pago', pago_em = ?, meio_pagamento = ? WHERE id = ? AND status <> 'pago'`,
      args: [evento.payment?.paymentDate ? `${evento.payment.paymentDate} 12:00:00` : instante, meio, vendaId],
    });
    vendaPaga = mudou > 0;
    if (vendaPaga) {
      const { rows: l } = await banco.execute({ sql: `SELECT lead_id FROM vendas WHERE id = ?`, args: [vendaId] });
      if (l[0]?.lead_id) {
        await banco.execute(eventoSql(String(l[0].lead_id), "pagamento_confirmado", `Pagamento confirmado pelo Asaas (${meio})`, { vendaId }));
      }
      await comemorarVenda(banco, vendaId);
    }
  } else if (interpretacao.statusVenda && interpretacao.statusVenda !== "pago") {
    await banco.execute({
      sql: `UPDATE vendas SET status = ? WHERE id = ? AND status <> 'pago'`,
      args: [interpretacao.statusVenda, vendaId],
    });
    if (interpretacao.statusVenda === "vencido") {
      await notificar(banco, { tipo: "pagamento", titulo: "Cobrança vencida", corpo: "Uma cobrança do Asaas venceu sem pagamento.", link: "/pagamentos" });
    }
  }

  await marcarProcessado(banco, eventoId, null);
  return { duplicado: false, ignorado: false, vendaPaga };
}

async function marcarProcessado(banco: Client, eventoId: string, erro: string | null): Promise<void> {
  await banco.execute({
    sql: `UPDATE webhook_eventos SET processado_em = ?, erro = ? WHERE provedor = 'asaas' AND evento_id = ?`,
    args: [agora(), erro, eventoId],
  });
}
