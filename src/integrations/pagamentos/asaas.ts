import { getBanco } from "@/db/cliente";
import { obterSegredo } from "@/integrations/segredos";

/**
 * Asaas — cobrança por Pix, boleto e cartão.
 *
 * Documentação: https://docs.asaas.com/reference
 * Ambientes: sandbox (https://api-sandbox.asaas.com/v3) e produção
 * (https://api.asaas.com/v3). A chave identifica o ambiente — chave de
 * sandbox não funciona em produção e vice-versa —, então o ambiente fica
 * explícito em Configurações (`asaas_ambiente`), começando em sandbox.
 *
 * O dinheiro nunca passa por esta aplicação: ela pede ao Asaas que crie
 * a cobrança e recebe, por webhook, o que aconteceu com ela.
 */

export interface PaymentProvider {
  readonly nome: string;
  pronto(): Promise<{ ok: boolean; motivo: string | null; ambiente: string }>;
  criarCobranca(entrada: NovaCobranca): Promise<CobrancaCriada>;
}

export type FormaCobranca = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export type NovaCobranca = {
  cliente: { nome: string; documento: string; email: string | null; telefone: string | null };
  valorCentavos: number;
  vencimento: string; // AAAA-MM-DD
  descricao: string;
  forma: FormaCobranca;
  /** Nosso id da venda — volta no webhook como `externalReference`. */
  referencia: string;
};

export type CobrancaCriada = {
  externoId: string;
  clienteExternoId: string;
  link: string | null;
  status: string;
};

export class ErroPagamento extends Error {}

const URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
} as const;

async function ambiente(): Promise<keyof typeof URLS> {
  const { rows } = await getBanco().execute(`SELECT valor FROM configuracoes WHERE chave = 'asaas_ambiente'`);
  return rows[0]?.valor === "producao" ? "producao" : "sandbox";
}

/** CPF (11) ou CNPJ (14) com dígitos verificadores válidos. */
export function documentoValido(bruto: string): boolean {
  const d = bruto.replace(/\D/g, "");
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const dv = (base: string, pesoInicial: number) => {
      const soma = [...base].reduce((t, c, i) => t + Number(c) * (pesoInicial - i), 0);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const dv = (base: string) => {
      const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const r = [...base].reduce((t, c, i) => t + Number(c) * pesos[i], 0) % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
  }
  return false;
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly nome = "asaas";

  constructor(private readonly http: typeof fetch = fetch) {}

  async pronto() {
    const amb = await ambiente();
    if (!(await obterSegredo("ASAAS_API_KEY"))) return { ok: false, motivo: "Chave do Asaas não configurada.", ambiente: amb };
    return { ok: true, motivo: null, ambiente: amb };
  }

  private async chamar<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<T> {
    const chave = await obterSegredo("ASAAS_API_KEY");
    if (!chave) throw new ErroPagamento("O Asaas não está configurado. Cole a chave em Configurações → Integrações.");
    const resposta = await this.http(`${URLS[await ambiente()]}${caminho}`, {
      method: metodo,
      headers: { access_token: chave, "Content-Type": "application/json", "User-Agent": "VynexaLeads" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const dados = (await resposta.json().catch(() => ({}))) as T & { errors?: Array<{ description?: string }> };
    if (!resposta.ok) {
      const motivo = dados.errors?.map((e) => e.description).filter(Boolean).join("; ") || `HTTP ${resposta.status}`;
      throw new ErroPagamento(
        resposta.status === 401 ? "O Asaas recusou a chave. Confira se ela é do ambiente escolhido (sandbox ou produção)." : `Asaas: ${motivo}`,
      );
    }
    return dados;
  }

  async criarCobranca(e: NovaCobranca): Promise<CobrancaCriada> {
    const documento = e.cliente.documento.replace(/\D/g, "");
    if (!documentoValido(documento)) throw new ErroPagamento("CPF ou CNPJ inválido.");
    if (e.valorCentavos < 500) throw new ErroPagamento("O Asaas exige cobrança de pelo menos R$ 5,00.");

    // Reaproveita o cliente se o documento já existe na conta.
    const busca = await this.chamar<{ data?: Array<{ id: string }> }>("GET", `/customers?cpfCnpj=${documento}&limit=1`);
    let clienteId = busca.data?.[0]?.id;
    if (!clienteId) {
      const criado = await this.chamar<{ id: string }>("POST", "/customers", {
        name: e.cliente.nome,
        cpfCnpj: documento,
        email: e.cliente.email ?? undefined,
        mobilePhone: e.cliente.telefone?.replace(/\D/g, "").replace(/^55/, "") || undefined,
        notificationDisabled: false,
      });
      clienteId = criado.id;
    }

    const cobranca = await this.chamar<{ id: string; invoiceUrl?: string; status: string }>("POST", "/payments", {
      customer: clienteId,
      billingType: e.forma,
      value: Math.round(e.valorCentavos) / 100,
      dueDate: e.vencimento,
      description: e.descricao.slice(0, 500),
      externalReference: e.referencia,
    });

    return { externoId: cobranca.id, clienteExternoId: clienteId, link: cobranca.invoiceUrl ?? null, status: cobranca.status };
  }
}

export function obterPagamentos(): PaymentProvider {
  return new AsaasPaymentProvider();
}
