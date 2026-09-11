/**
 * Stripe, pela API REST.
 *
 * Sem o SDK oficial de propósito: usamos duas chamadas — criar sessão de
 * checkout e conferir assinatura de webhook — e o SDK traz um cliente
 * HTTP inteiro junto. A API é `application/x-www-form-urlencoded`, o que
 * o `URLSearchParams` já resolve.
 *
 * **O dinheiro nunca passa por esta aplicação.** O cliente é levado à
 * página da Stripe, que é certificada e coleta o cartão lá. Aqui não
 * existe campo de cartão, e não vai existir: hospedar isso significaria
 * assumir escopo de PCI sem ganho nenhum.
 */

const API = "https://api.stripe.com/v1";

export class ErroStripe extends Error {}

function getChave(): string {
  const chave = (process.env.STRIPE_SECRET_KEY ?? "").replace(/\s+/g, "");
  if (chave === "") {
    throw new ErroStripe(
      "STRIPE_SECRET_KEY ausente. Pegue em https://dashboard.stripe.com/apikeys e cadastre nas variáveis da Vercel. Ver docs/SETUP.md.",
    );
  }
  return chave;
}

export function getSegredoWebhook(): string {
  const s = (process.env.STRIPE_WEBHOOK_SECRET ?? "").replace(/\s+/g, "");
  if (s === "") {
    throw new ErroStripe(
      "STRIPE_WEBHOOK_SECRET ausente. Ele aparece ao criar o endpoint em https://dashboard.stripe.com/webhooks.",
    );
  }
  return s;
}

/** Verdadeiro quando a chave é de teste — a interface avisa o operador. */
export function emModoTeste(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

export type NovoCheckout = {
  descricao: string;
  valorCentavos: number;
  moeda: string;
  /** Volta no webhook e liga o pagamento à venda registrada aqui. */
  vendaId: string;
  urlSucesso: string;
  urlCancelamento: string;
  emailCliente?: string | null;
};

export type SessaoCheckout = { id: string; url: string };

/**
 * Cria a sessão e devolve o link para mandar ao cliente.
 *
 * Usa `price_data` em vez de um `price` pré-criado: cada proposta tem
 * valor próprio, e criar um objeto Price no catálogo da Stripe a cada
 * orçamento encheria a conta de preços descartáveis.
 */
export async function criarSessaoCheckout(entrada: NovoCheckout): Promise<SessaoCheckout> {
  if (!Number.isInteger(entrada.valorCentavos) || entrada.valorCentavos < 100) {
    throw new ErroStripe("O valor precisa ser um número inteiro de centavos, a partir de R$ 1,00.");
  }

  const corpo = new URLSearchParams({
    mode: "payment",
    success_url: entrada.urlSucesso,
    cancel_url: entrada.urlCancelamento,
    // Chega de volta no webhook. É por ele que a venda certa é marcada
    // como paga, em vez de depender da ordem de chegada dos eventos.
    "metadata[venda_id]": entrada.vendaId,
    client_reference_id: entrada.vendaId,
    locale: "pt-BR",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": entrada.moeda.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(entrada.valorCentavos),
    "line_items[0][price_data][product_data][name]": entrada.descricao,
  });

  if (entrada.emailCliente) corpo.set("customer_email", entrada.emailCliente);

  const resposta = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      // Autenticação básica com a chave como usuário e senha vazia, que
      // é o formato do `-u "sk_..."` do curl.
      Authorization: `Basic ${Buffer.from(`${getChave()}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: corpo,
    signal: AbortSignal.timeout(20_000),
  });

  const dados = (await resposta.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!resposta.ok || !dados.id || !dados.url) {
    throw new ErroStripe(
      dados.error?.message ?? `A Stripe recusou a criação do checkout (${resposta.status}).`,
    );
  }

  return { id: dados.id, url: dados.url };
}

/**
 * Confere a assinatura do webhook.
 *
 * Sem isto, qualquer pessoa que descubra a URL pode postar um evento
 * falso e registrar vendas que nunca existiram. O cabeçalho vem como
 * `t=<timestamp>,v1=<hmac>`, e o HMAC-SHA256 é calculado sobre
 * `${t}.${corpo_cru}` com o segredo do endpoint.
 *
 * O corpo precisa ser o texto CRU. Passar o JSON já reserializado muda
 * um espaço que seja e a assinatura não bate.
 */
export async function assinaturaValida(
  corpoCru: string,
  cabecalho: string | null,
  toleranciaSegundos = 300,
): Promise<boolean> {
  if (!cabecalho) return false;

  const partes = new Map(
    cabecalho.split(",").map((p) => {
      const [k, ...resto] = p.trim().split("=");
      return [k ?? "", resto.join("=")] as const;
    }),
  );

  const t = partes.get("t");
  const v1 = partes.get("v1");
  if (!t || !v1) return false;

  // Janela de tolerância contra repetição: um evento legítimo capturado
  // hoje não pode ser reenviado semana que vem para duplicar a venda.
  const idade = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(idade) || idade > toleranciaSegundos) return false;

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSegredoWebhook()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${t}.${corpoCru}`),
  );

  const esperado = Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Tempo constante: comparar com === sai no primeiro byte diferente, e
  // essa diferença de tempo é o que permite forjar a assinatura aos poucos.
  if (esperado.length !== v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i += 1) {
    diferenca |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diferenca === 0;
}

export { formatarDinheiro, paraCentavos } from "@/lib/pagamento/dinheiro";
