import { z } from "zod";

import { anexarSessaoStripe, criarVendaPendente } from "@/db/vendas";
import { ehLimiteDiarioD1, MENSAGEM_COTA_D1 } from "@/db/cliente";
import { criarSessaoCheckout, ErroStripe, paraCentavos } from "@/lib/pagamento/stripe";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Gera o link de checkout.
 *
 * A venda nasce como `pendente` ANTES de falar com a Stripe: é o id dela
 * que vai no `metadata`, e é por ele que o webhook sabe o que marcar como
 * pago. Criar depois abriria a janela em que o cliente paga mais rápido
 * do que a nossa linha é gravada.
 */
const Esquema = z.object({
  descricao: z.string().trim().min(3).max(200),
  /** Texto livre: "1.297,00", "1297", "R$ 1297,00" — normalizado no servidor. */
  valor: z.string().trim().min(1),
  moeda: z.string().trim().length(3).default("BRL"),
  leadId: z.string().trim().nullish(),
  clienteEmail: z.email().nullish().or(z.literal("")),
  clienteNome: z.string().trim().max(120).nullish(),
});

export async function POST(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const analise = Esquema.safeParse(corpo);
  if (!analise.success) {
    return Response.json(
      { erro: analise.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { descricao, valor, moeda, leadId, clienteEmail, clienteNome } = analise.data;

  const centavos = paraCentavos(valor);
  if (centavos === null || centavos < 100) {
    return Response.json({ erro: "Informe um valor de pelo menos R$ 1,00." }, { status: 400 });
  }

  const origem = new URL(request.url).origin;

  let vendaId: string;
  try {
    vendaId = await criarVendaPendente({
      descricao,
      valorCentavos: centavos,
      moeda,
      leadId: leadId || null,
      clienteEmail: clienteEmail || null,
      clienteNome: clienteNome || null,
    });
  } catch (erro) {
    if (!ehLimiteDiarioD1(erro)) throw erro;
    return Response.json({ erro: MENSAGEM_COTA_D1 }, { status: 503 });
  }

  try {
    const sessao = await criarSessaoCheckout({
      descricao,
      valorCentavos: centavos,
      moeda,
      vendaId,
      urlSucesso: `${origem}/vendas?pago=1`,
      urlCancelamento: `${origem}/vendas?cancelado=1`,
      emailCliente: clienteEmail || null,
    });

    await anexarSessaoStripe(vendaId, sessao.id);

    return Response.json({ url: sessao.url, vendaId }, { status: 201 });
  } catch (erro) {
    // A venda pendente fica no banco de propósito, e a tela mostra que
    // ficou sem link. Apagar em silêncio esconderia que a tentativa
    // aconteceu, e é justamente isso que se quer investigar quando a
    // Stripe recusa.
    return Response.json(
      { erro: erro instanceof ErroStripe ? erro.message : "Falha ao criar o checkout." },
      { status: 502 },
    );
  }
}
