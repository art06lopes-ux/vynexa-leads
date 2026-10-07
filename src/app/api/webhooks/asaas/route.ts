import { getBanco } from "@/db/cliente";
import { obterSegredo } from "@/integrations/segredos";
import { processarWebhookAsaas } from "@/services/financeiro";
import { tokenConfere, type EventoAsaas } from "@/services/pagamentos";

/**
 * Webhook do Asaas.
 *
 * Sem sessão (quem chama é o Asaas). A autenticação é o token que você
 * define ao cadastrar o webhook no painel do Asaas — ele chega no
 * cabeçalho `asaas-access-token` e é comparado em tempo constante com o
 * ASAAS_WEBHOOK_TOKEN salvo em Configurações. Sem token configurado, a
 * rota recusa tudo: um webhook aberto deixaria qualquer um "confirmar"
 * pagamentos que não existiram.
 *
 * Respostas: 200 para evento processado, repetido ou ignorado (o Asaas
 * para de reenviar); 401 para token errado; 500 só quando o nosso lado
 * falhou — aí o Asaas reenvia mais tarde, que é o que queremos.
 */
export async function POST(request: Request) {
  const esperado = await obterSegredo("ASAAS_WEBHOOK_TOKEN");
  if (!esperado) return Response.json({ erro: "Webhook do Asaas não configurado." }, { status: 503 });
  if (!tokenConfere(esperado, request.headers.get("asaas-access-token"))) {
    return Response.json({ erro: "Token inválido." }, { status: 401 });
  }

  const bruto = await request.text();
  let evento: EventoAsaas;
  try {
    evento = JSON.parse(bruto) as EventoAsaas;
  } catch {
    return Response.json({ erro: "JSON inválido." }, { status: 400 });
  }

  try {
    const r = await processarWebhookAsaas(getBanco(), evento, bruto);
    return Response.json({ ok: true, ...r });
  } catch (erro) {
    console.error("[webhook asaas]", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Falha ao processar; o Asaas tentará de novo." }, { status: 500 });
  }
}
