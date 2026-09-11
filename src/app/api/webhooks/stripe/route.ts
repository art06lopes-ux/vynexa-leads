import { marcarComoPaga } from "@/db/vendas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { notificarTodos } from "@/lib/push/enviar";
import { assinaturaValida } from "@/lib/pagamento/stripe";

/**
 * Webhook da Stripe.
 *
 * É a única rota do projeto que NÃO exige sessão — quem chama é a
 * Stripe, não o operador. O que substitui o login aqui é a assinatura
 * HMAC do cabeçalho `stripe-signature`: sem ela, qualquer um que
 * descobrisse esta URL registraria vendas que nunca existiram.
 *
 * O `matcher` do proxy precisa deixar esta rota passar, e deixa: ela não
 * está na lista de rotas protegidas porque o proxy só redireciona quando
 * falta sessão — e este endpoint responde antes disso, com 401 próprio.
 */

export async function POST(request: Request) {
  // Texto cru, não `request.json()`. A assinatura é calculada sobre os
  // bytes exatos que a Stripe enviou; reserializar muda um espaço e a
  // conferência falha sem motivo aparente.
  const corpo = await request.text();

  let valida: boolean;
  try {
    valida = await assinaturaValida(corpo, request.headers.get("stripe-signature"));
  } catch (erro) {
    // Segredo do webhook não configurado. 500 e não 400: o problema é
    // nosso, e devolver 400 faria a Stripe desistir de reenviar.
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Webhook mal configurado." },
      { status: 500 },
    );
  }

  if (!valida) {
    return Response.json({ erro: "Assinatura inválida." }, { status: 401 });
  }

  const evento = JSON.parse(corpo) as {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };

  // Só este evento interessa por ora. Os demais recebem 200 de propósito:
  // devolver erro faria a Stripe reenviar para sempre algo que nunca
  // vamos processar, e acabaria desativando o endpoint.
  if (evento.type !== "checkout.session.completed") {
    return Response.json({ ignorado: evento.type ?? "desconhecido" });
  }

  const sessao = evento.data?.object ?? {};
  const vendaId =
    (sessao.metadata as Record<string, string> | undefined)?.venda_id ??
    (typeof sessao.client_reference_id === "string" ? sessao.client_reference_id : null);

  if (!vendaId) {
    return Response.json({ erro: "Evento sem venda_id." }, { status: 400 });
  }

  // `payment_status` é a confirmação de que o dinheiro entrou. Uma sessão
  // pode ser concluída sem pagamento (boleto ainda em aberto, por
  // exemplo), e marcar como paga aí inflaria o faturamento.
  if (sessao.payment_status !== "paid") {
    return Response.json({ ignorado: "sessão concluída sem pagamento confirmado" });
  }

  const detalhes = sessao.customer_details as
    | { email?: string; name?: string }
    | undefined;

  const primeiraVez = await marcarComoPaga(vendaId, {
    sessionId: typeof sessao.id === "string" ? sessao.id : "",
    paymentIntent: typeof sessao.payment_intent === "string" ? sessao.payment_intent : null,
    email: detalhes?.email ?? null,
    nome: detalhes?.name ?? null,
  });

  // Só na primeira confirmação: a Stripe reenvia eventos, e cada reenvio
  // não pode virar mais uma notificação no celular.
  if (primeiraVez) {
    const centavos = typeof sessao.amount_total === "number" ? sessao.amount_total : 0;
    await notificarTodos({
      titulo: "Venda realizada",
      corpo: `Você recebeu: ${formatarDinheiro(centavos)}${detalhes?.name ? ` · ${detalhes.name}` : ""}`,
      url: "/vendas",
    });
  }

  // 200 nos dois casos: reenvio de um evento já processado não é erro, e
  // responder diferente faria a Stripe insistir à toa.
  return Response.json({ ok: true, novo: primeiraVez });
}
