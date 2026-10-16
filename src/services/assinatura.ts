import { agora, getBancoPrincipal, novoId } from "@/db/cliente";
import { comConta, CONTA_PRINCIPAL } from "@/db/contas-banco";
import { avisarDono } from "@/integrations/notificacoes";
import { AsaasPaymentProvider, documentoValido, ErroPagamento } from "@/integrations/pagamentos/asaas";
import type { EventoAsaas } from "@/services/pagamentos";
import { formatarPreco, type IdPlano } from "@/lib/planos";
import { atualizarConta, ErroConta, estenderValidade, lerConta, planoPorId, type Conta } from "@/services/contas";

/**
 * Cobrança das assinaturas do SaaS pelo Asaas do DONO.
 *
 * Uma assinatura mensal no Asaas por conta (`/subscriptions`, ciclo
 * MONTHLY). O cliente escolhe Pix, boleto ou cartão na página de
 * pagamento do próprio Asaas — o dinheiro e os dados do cartão nunca
 * passam por aqui. O que liga o pagamento à conta é o
 * `externalReference` = `saas:<conta>:<plano>`, que volta em cada
 * cobrança gerada pela assinatura e chega no webhook.
 */

const PREFIXO = "saas:";

export function referenciaSaas(contaId: string, plano: IdPlano): string {
  return `${PREFIXO}${contaId}:${plano}`;
}

export function lerReferenciaSaas(ref: string | null | undefined): { contaId: string; plano: IdPlano } | null {
  if (!ref?.startsWith(PREFIXO)) return null;
  const [contaId, plano] = ref.slice(PREFIXO.length).split(":");
  if (!contaId || !["essencial", "pro", "agencia"].includes(plano)) return null;
  return { contaId, plano: plano as IdPlano };
}

/** Tudo do Asaas aqui é com a chave e o ambiente da conta do dono. */
function noAsaasDoDono<T>(fn: (asaas: AsaasPaymentProvider) => Promise<T>): Promise<T> {
  return comConta(CONTA_PRINCIPAL, () => fn(new AsaasPaymentProvider()));
}

export async function cobrancaDisponivel(): Promise<boolean> {
  return noAsaasDoDono(async (a) => (await a.pronto()).ok).catch(() => false);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Assina (ou troca de plano) e devolve o link da cobrança em aberto.
 * Trocar de plano atualiza o valor da assinatura existente — inclusive
 * da cobrança que ainda não foi paga.
 */
export async function iniciarAssinatura(e: {
  conta: Conta;
  plano: IdPlano;
  documento: string;
  email: string;
  nome: string;
  telefone: string | null;
}): Promise<{ link: string | null }> {
  const documento = e.documento.replace(/\D/g, "");
  if (!documentoValido(documento)) throw new ErroConta("CPF ou CNPJ inválido.");
  const plano = await planoPorId(e.plano);
  if (plano.id === "dono") throw new ErroConta("Plano inválido.");
  const valor = plano.precoCentavos / 100;
  const descricao = `Vynexa Leads — plano ${plano.nome} (mensal)`;
  const referencia = referenciaSaas(e.conta.id, plano.id);

  return noAsaasDoDono(async (asaas) => {
    if (!(await asaas.pronto()).ok) throw new ErroConta("A cobrança ainda não está ligada. Fale com o suporte pelo WhatsApp.", 503);

    let clienteId = e.conta.asaas_cliente_id;
    if (!clienteId) {
      const busca = await asaas.chamar<{ data?: Array<{ id: string }> }>("GET", `/customers?cpfCnpj=${documento}&limit=1`);
      clienteId =
        busca.data?.[0]?.id ??
        (
          await asaas.chamar<{ id: string }>("POST", "/customers", {
            name: e.conta.nome || e.nome,
            cpfCnpj: documento,
            email: e.email,
            mobilePhone: e.telefone?.replace(/\D/g, "").replace(/^55/, "") || undefined,
            externalReference: `${PREFIXO}${e.conta.id}`,
          })
        ).id;
    }

    let assinaturaId = e.conta.asaas_assinatura_id;
    if (assinaturaId) {
      await asaas.chamar("POST", `/subscriptions/${assinaturaId}`, {
        value: valor,
        description: descricao,
        externalReference: referencia,
        updatePendingPayments: true,
      });
    } else {
      const criada = await asaas.chamar<{ id: string }>("POST", "/subscriptions", {
        customer: clienteId,
        billingType: "UNDEFINED", // o cliente escolhe Pix, boleto ou cartão na página do Asaas
        value: valor,
        nextDueDate: hoje(),
        cycle: "MONTHLY",
        description: descricao,
        externalReference: referencia,
      });
      assinaturaId = criada.id;
    }

    await atualizarConta(e.conta.id, { documento, asaas_cliente_id: clienteId, asaas_assinatura_id: assinaturaId, plano: plano.id });

    const pagamentos = await asaas.chamar<{ data?: Array<{ id: string; invoiceUrl?: string; status: string; value: number; dueDate: string }> }>(
      "GET",
      `/subscriptions/${assinaturaId}/payments?status=PENDING`,
    );
    const aberto = pagamentos.data?.[0];
    if (aberto) await gravarFatura(e.conta.id, aberto.id, { plano: plano.id, valorCentavos: Math.round(aberto.value * 100), status: "pendente", vencimento: aberto.dueDate, link: aberto.invoiceUrl ?? null });
    return { link: aberto?.invoiceUrl ?? null };
  }).catch((erro) => {
    if (erro instanceof ErroPagamento) throw new ErroConta(erro.message, 502);
    throw erro;
  });
}

export async function cancelarAssinatura(contaId: string, motivo: string): Promise<void> {
  const conta = await lerConta(contaId);
  if (!conta) throw new ErroConta("Conta não encontrada.", 404);
  if (conta.asaas_assinatura_id) {
    await noAsaasDoDono((a) => a.chamar("DELETE", `/subscriptions/${conta.asaas_assinatura_id}`)).catch((erro) => {
      // Já apagada no Asaas: segue cancelando aqui.
      console.error("[assinatura] cancelar no Asaas:", erro instanceof Error ? erro.message : erro);
    });
  }
  await atualizarConta(contaId, { status: "cancelada", cancelada_em: agora(), asaas_assinatura_id: null });
  await avisarDono({ tipo: "assinatura", titulo: `Cancelamento: ${conta.nome}`, corpo: motivo, link: `/admin/membros/${contaId}` });
}

async function gravarFatura(
  contaId: string,
  pagamentoId: string,
  f: { plano: string | null; valorCentavos: number; status: string; vencimento: string | null; link: string | null; forma?: string | null; pagoEm?: string | null },
): Promise<void> {
  await getBancoPrincipal().execute({
    sql: `INSERT INTO faturas (id, conta_id, asaas_pagamento_id, plano, valor_centavos, status, forma, vencimento, pago_em, link, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(asaas_pagamento_id) DO UPDATE SET status = excluded.status, valor_centavos = excluded.valor_centavos,
            forma = COALESCE(excluded.forma, faturas.forma), vencimento = COALESCE(excluded.vencimento, faturas.vencimento),
            pago_em = COALESCE(excluded.pago_em, faturas.pago_em), link = COALESCE(excluded.link, faturas.link),
            plano = COALESCE(excluded.plano, faturas.plano), atualizado_em = excluded.atualizado_em`,
    args: [novoId(), contaId, pagamentoId, f.plano, f.valorCentavos, f.status, f.forma ?? null, f.vencimento, f.pagoEm ?? null, f.link, agora(), agora()],
  });
}

/**
 * Evento do Asaas que é de assinatura do SaaS? Processa e devolve true;
 * senão devolve false e o webhook segue para as vendas do dono.
 */
export async function processarEventoSaas(evento: EventoAsaas & { payment?: { subscription?: string | null } }): Promise<boolean> {
  const pagamento = evento.payment;
  let alvo = lerReferenciaSaas(pagamento?.externalReference);
  if (!alvo && pagamento?.subscription) {
    const { rows } = await getBancoPrincipal().execute({ sql: `SELECT id, plano FROM contas WHERE asaas_assinatura_id = ?`, args: [pagamento.subscription] });
    if (rows[0]) alvo = { contaId: String(rows[0].id), plano: String(rows[0].plano) as IdPlano };
  }
  if (!alvo || !pagamento?.id) {
    // Assinatura apagada/inativada no painel do Asaas.
    if (evento.event === "SUBSCRIPTION_DELETED" || evento.event === "SUBSCRIPTION_INACTIVATED") {
      const sub = (evento as { subscription?: { id?: string } }).subscription?.id;
      if (!sub) return false;
      const { rows } = await getBancoPrincipal().execute({ sql: `SELECT id FROM contas WHERE asaas_assinatura_id = ?`, args: [sub] });
      if (!rows[0]) return false;
      await atualizarConta(String(rows[0].id), { status: "cancelada", cancelada_em: agora(), asaas_assinatura_id: null });
      return true;
    }
    return false;
  }

  const conta = await lerConta(alvo.contaId);
  if (!conta) return true; // conta excluída: o evento é nosso, mas não há o que atualizar
  const valorCentavos = Math.round((pagamento.value ?? 0) * 100);
  const base = { plano: alvo.plano, valorCentavos, vencimento: pagamento.dueDate ?? null, link: pagamento.invoiceUrl ?? null, forma: pagamento.billingType ?? null };

  switch (evento.event) {
    case "PAYMENT_CREATED":
    case "PAYMENT_UPDATED":
      await gravarFatura(conta.id, pagamento.id, { ...base, status: "pendente" });
      break;
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      const { rows } = await getBancoPrincipal().execute({ sql: `SELECT status FROM faturas WHERE asaas_pagamento_id = ?`, args: [pagamento.id] });
      if (rows[0]?.status === "paga") break; // CONFIRMED e depois RECEIVED: estende uma vez só
      await gravarFatura(conta.id, pagamento.id, { ...base, status: "paga", pagoEm: pagamento.paymentDate ?? pagamento.confirmedDate ?? agora().slice(0, 10) });
      await atualizarConta(conta.id, { status: "ativa", plano: alvo.plano, valida_ate: estenderValidade(conta.valida_ate, 31), cancelada_em: null });
      await avisarDono({
        tipo: "assinatura",
        titulo: `Pagamento recebido: ${formatarPreco(valorCentavos)}`,
        corpo: `${conta.nome} · plano ${alvo.plano.toUpperCase()}`,
        link: `/admin/membros/${conta.id}`,
      });
      break;
    }
    case "PAYMENT_OVERDUE":
      await gravarFatura(conta.id, pagamento.id, { ...base, status: "atrasada" });
      if (conta.status !== "cancelada") await atualizarConta(conta.id, { status: "atrasada" });
      await avisarDono({ tipo: "assinatura", titulo: `Cobrança vencida: ${conta.nome}`, corpo: `${formatarPreco(valorCentavos)} · plano ${alvo.plano.toUpperCase()}`, link: `/admin/membros/${conta.id}` });
      break;
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      await gravarFatura(conta.id, pagamento.id, { ...base, status: "estornada" });
      await atualizarConta(conta.id, { status: "atrasada", valida_ate: agora() });
      await avisarDono({ tipo: "assinatura", titulo: `Estorno: ${conta.nome}`, corpo: `${formatarPreco(valorCentavos)} devolvido. Acesso travado.`, link: `/admin/membros/${conta.id}` });
      break;
    case "PAYMENT_DELETED":
      await gravarFatura(conta.id, pagamento.id, { ...base, status: "cancelada" });
      break;
    default:
      break;
  }
  return true;
}
