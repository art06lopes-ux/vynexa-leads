/**
 * Eventos de pagamento do Asaas → estado da cobrança e da venda.
 *
 * Puro, para ser testado sem rede. Referência dos eventos:
 * https://docs.asaas.com/docs/eventos-de-webhooks
 */

export type StatusCobranca = "pendente" | "confirmado" | "recebido" | "vencido" | "cancelado" | "estornado";

export type EventoAsaas = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    netValue?: number;
    billingType?: string;
    externalReference?: string | null;
    invoiceUrl?: string;
    dueDate?: string;
    paymentDate?: string | null;
    confirmedDate?: string | null;
  };
};

export type Interpretacao = {
  statusCobranca: StatusCobranca;
  /** A venda passa a "pago"? */
  pago: boolean;
  /** Mostrar a notificação de venda? Só no primeiro evento de pagamento. */
  comemorar: boolean;
  /** Estado da venda, quando o evento a muda. */
  statusVenda: "pendente" | "pago" | "vencido" | "cancelado" | "reembolsado" | null;
};

const MAPA: Record<string, Interpretacao> = {
  PAYMENT_CREATED: { statusCobranca: "pendente", pago: false, comemorar: false, statusVenda: null },
  PAYMENT_UPDATED: { statusCobranca: "pendente", pago: false, comemorar: false, statusVenda: null },
  PAYMENT_CONFIRMED: { statusCobranca: "confirmado", pago: true, comemorar: true, statusVenda: "pago" },
  PAYMENT_RECEIVED: { statusCobranca: "recebido", pago: true, comemorar: true, statusVenda: "pago" },
  PAYMENT_OVERDUE: { statusCobranca: "vencido", pago: false, comemorar: false, statusVenda: "vencido" },
  PAYMENT_DELETED: { statusCobranca: "cancelado", pago: false, comemorar: false, statusVenda: "cancelado" },
  PAYMENT_REFUNDED: { statusCobranca: "estornado", pago: false, comemorar: false, statusVenda: "reembolsado" },
  PAYMENT_RECEIVED_IN_CASH_UNDONE: { statusCobranca: "pendente", pago: false, comemorar: false, statusVenda: "pendente" },
  PAYMENT_CHARGEBACK_REQUESTED: { statusCobranca: "estornado", pago: false, comemorar: false, statusVenda: "reembolsado" },
};

export function interpretarEventoAsaas(evento: EventoAsaas): Interpretacao | null {
  return evento.event ? (MAPA[evento.event] ?? null) : null;
}

export const ROTULO_COBRANCA: Record<StatusCobranca, string> = {
  pendente: "Aguardando pagamento",
  confirmado: "Confirmado",
  recebido: "Recebido",
  vencido: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

/** Token do webhook confere? Comparação em tempo constante. */
export function tokenConfere(esperado: string | null, recebido: string | null): boolean {
  if (!esperado || !recebido || esperado.length !== recebido.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i += 1) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}
