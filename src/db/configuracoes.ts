import "server-only";

import { agora, getBanco } from "@/db/cliente";

/**
 * Ajustes editáveis pela interface.
 *
 * Só o que pode mudar sem redeploy mora aqui. Credencial continua em
 * variável de ambiente: guardar chave da Stripe no banco aumentaria a
 * superfície exposta sem ganhar nada — quem lê o banco passaria a ler a
 * chave também.
 */

export async function lerConfiguracoes(): Promise<Record<string, string>> {
  const { rows } = await getBanco().execute(`SELECT chave, valor FROM configuracoes`);
  return Object.fromEntries(rows.map((r) => [String(r.chave), String(r.valor)]));
}

export async function lerConfiguracao(chave: string, padrao = ""): Promise<string> {
  const { rows } = await getBanco().execute({
    sql: `SELECT valor FROM configuracoes WHERE chave = ?`,
    args: [chave],
  });
  return rows[0] ? String(rows[0].valor) : padrao;
}

export async function gravarConfiguracao(chave: string, valor: string): Promise<void> {
  await getBanco().execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [chave, valor, agora()],
  });
}

export type EstadoIntegracao = {
  nome: string;
  ligada: boolean;
  detalhe: string;
};

/**
 * Diagnóstico das integrações.
 *
 * Reporta apenas se a variável existe — **nunca o valor**. O objetivo é
 * responder "por que isso não está funcionando?" sem transformar a tela
 * de ajustes num vazamento de credenciais.
 */
export function diagnosticarIntegracoes(): EstadoIntegracao[] {
  const tem = (nome: string) => (process.env[nome] ?? "").trim() !== "";
  const chaveStripe = (process.env.STRIPE_SECRET_KEY ?? "").trim();

  return [
    {
      nome: "Banco (Turso)",
      ligada: tem("TURSO_DATABASE_URL"),
      detalhe: tem("TURSO_DATABASE_URL")
        ? "Conectado — esta página não carregaria sem isso."
        : "TURSO_DATABASE_URL ausente.",
    },
    {
      nome: "OpenStreetMap",
      ligada: tem("OSM_CONTATO"),
      detalhe: tem("OSM_CONTATO")
        ? "Contato configurado no User-Agent."
        : "Sem OSM_CONTATO, a Overpass pode bloquear sem aviso.",
    },
    {
      nome: "Análise de IA (Gemini)",
      ligada: tem("GEMINI_API_KEY"),
      detalhe: tem("GEMINI_API_KEY")
        ? "Chave presente. Usada só pelo worker."
        : "Sem GEMINI_API_KEY no worker, a análise falha.",
    },
    {
      nome: "Checkout (Stripe)",
      ligada: chaveStripe !== "",
      detalhe:
        chaveStripe === ""
          ? "STRIPE_SECRET_KEY ausente — não é possível gerar link de cobrança."
          : chaveStripe.startsWith("sk_test_")
            ? "Modo de TESTE: pagamentos simulados, nenhum dinheiro entra."
            : "Modo de produção.",
    },
    {
      nome: "Webhook da Stripe",
      ligada: tem("STRIPE_WEBHOOK_SECRET"),
      detalhe: tem("STRIPE_WEBHOOK_SECRET")
        ? "Assinatura conferida a cada evento."
        : "Sem STRIPE_WEBHOOK_SECRET, as vendas não são confirmadas sozinhas.",
    },
  ];
}
