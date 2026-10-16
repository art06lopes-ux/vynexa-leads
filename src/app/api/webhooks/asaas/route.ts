import { getBanco } from "@/db/cliente";
import { comConta, CONTA_PRINCIPAL } from "@/db/contas-banco";
import { obterSegredo } from "@/integrations/segredos";
import { processarEventoSaas } from "@/services/assinatura";
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
/**
 * Sem `?conta=`: é o Asaas do DONO — tanto as assinaturas do SaaS quanto
 * as vendas dele. Com `?conta=<id>`: o Asaas de um assinante (plano
 * Agência), com o token que ele mesmo configurou.
 */
export async function POST(request: Request) {
  const conta = new URL(request.url).searchParams.get("conta") ?? CONTA_PRINCIPAL;
  if (!/^[a-z0-9-]{1,64}$/i.test(conta)) return Response.json({ erro: "Conta inválida." }, { status: 400 });
  return comConta(conta, () => processar(request, conta === CONTA_PRINCIPAL)).catch(() => Response.json({ erro: "Conta inválida." }, { status: 404 }));
}

async function processar(request: Request, doDono: boolean): Promise<Response> {
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
    if (doDono && (await processarEventoSaas(evento))) return Response.json({ ok: true, assinatura: true });
    const r = await processarWebhookAsaas(getBanco(), evento, bruto);
    return Response.json({ ok: true, ...r });
  } catch (erro) {
    console.error("[webhook asaas]", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Falha ao processar; o Asaas tentará de novo." }, { status: 500 });
  }
}
