import "server-only";

import { agora, getBanco, novoId } from "@/db/cliente";
import { PERIODOS, type ChavePeriodo, type PontoReceita } from "@/lib/vendas/periodos";

export type StatusVenda = "pendente" | "pago" | "cancelado" | "reembolsado";

export type Venda = {
  id: string;
  produto_id: string | null;
  lead_id: string | null;
  descricao: string;
  valor_centavos: number;
  moeda: string;
  status: StatusVenda;
  origem: "stripe" | "manual";
  meio_pagamento: "pix" | "transferencia" | "dinheiro" | "cartao_stripe" | "outro" | null;
  stripe_session_id: string | null;
  cliente_email: string | null;
  cliente_nome: string | null;
  criado_em: string;
  pago_em: string | null;
};

export {
  PERIODOS,
  ehPeriodo,
  type ChavePeriodo,
  type PontoReceita,
} from "@/lib/vendas/periodos";

// ---------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------

export async function criarVendaPendente(entrada: {
  descricao: string;
  valorCentavos: number;
  moeda: string;
  leadId?: string | null;
  clienteEmail?: string | null;
  clienteNome?: string | null;
}): Promise<string> {
  const id = novoId();
  await getBanco().execute({
    sql: `INSERT INTO vendas (id, descricao, valor_centavos, moeda, status, origem, lead_id, cliente_email, cliente_nome)
          VALUES (?, ?, ?, ?, 'pendente', 'stripe', ?, ?, ?)`,
    args: [
      id,
      entrada.descricao,
      entrada.valorCentavos,
      entrada.moeda,
      entrada.leadId ?? null,
      entrada.clienteEmail ?? null,
      entrada.clienteNome ?? null,
    ],
  });
  return id;
}

export async function anexarSessaoStripe(vendaId: string, sessionId: string): Promise<void> {
  await getBanco().execute({
    sql: `UPDATE vendas SET stripe_session_id = ? WHERE id = ?`,
    args: [sessionId, vendaId],
  });
}

export async function registrarVendaManual(entrada: {
  descricao: string;
  valorCentavos: number;
  moeda: string;
  clienteNome?: string | null;
}): Promise<void> {
  await getBanco().execute({
    sql: `INSERT INTO vendas (id, descricao, valor_centavos, moeda, status, origem, cliente_nome, pago_em)
          VALUES (?, ?, ?, ?, 'pago', 'manual', ?, ?)`,
    args: [
      novoId(),
      entrada.descricao,
      entrada.valorCentavos,
      entrada.moeda,
      entrada.clienteNome ?? null,
      agora(),
    ],
  });
}

/**
 * Marca a venda como paga, a partir do webhook.
 *
 * `WHERE status <> 'pago'` torna a operação idempotente: a Stripe reenvia
 * o mesmo evento até receber 200, e sem essa condição o `pago_em` seria
 * reescrito a cada reenvio. `rowsAffected` diz se foi a primeira vez.
 */
export async function marcarComoPaga(
  vendaId: string,
  dados: { sessionId: string; paymentIntent: string | null; email: string | null; nome: string | null },
): Promise<boolean> {
  const { rowsAffected } = await getBanco().execute({
    sql: `UPDATE vendas
          SET status = 'pago',
              pago_em = ?,
              meio_pagamento = 'cartao_stripe',
              stripe_session_id = COALESCE(stripe_session_id, ?),
              stripe_payment_intent = ?,
              cliente_email = COALESCE(?, cliente_email),
              cliente_nome = COALESCE(?, cliente_nome)
          WHERE id = ? AND status <> 'pago'`,
    args: [agora(), dados.sessionId, dados.paymentIntent, dados.email, dados.nome, vendaId],
  });
  return rowsAffected > 0;
}

export async function cancelarVenda(vendaId: string): Promise<void> {
  await getBanco().execute({
    sql: `UPDATE vendas SET status = 'cancelado' WHERE id = ? AND status = 'pendente'`,
    args: [vendaId],
  });
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------

export type ResumoVendas = {
  totalCentavos: number;
  quantidade: number;
  ticketCentavos: number;
  pendentes: number;
};

export async function obterResumo(periodo: ChavePeriodo): Promise<ResumoVendas> {
  const dias = PERIODOS[periodo].dias;
  const banco = getBanco();

  const [{ rows: pagas }, { rows: pend }] = await Promise.all([
    banco.execute({
      sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS total, COUNT(*) AS n
            FROM vendas
            WHERE status = 'pago' AND pago_em >= date('now', ?)`,
      args: [`-${dias - 1} days`],
    }),
    banco.execute(`SELECT COUNT(*) AS n FROM vendas WHERE status = 'pendente'`),
  ]);

  const total = Number(pagas[0]?.total ?? 0);
  const quantidade = Number(pagas[0]?.n ?? 0);

  return {
    totalCentavos: total,
    quantidade,
    // Divisão inteira e guarda contra zero: sem venda, ticket médio é
    // zero, não NaN aparecendo na tela como "R$ NaN".
    ticketCentavos: quantidade > 0 ? Math.round(total / quantidade) : 0,
    pendentes: Number(pend[0]?.n ?? 0),
  };
}

/**
 * Receita por dia. Dias sem venda entram como zero.
 *
 * Sem esse preenchimento a linha ligaria uma venda de segunda direto na
 * de sexta, escondendo os dias parados — que é exatamente a informação
 * que um gráfico de receita precisa mostrar.
 */
export async function obterSerieReceita(periodo: ChavePeriodo): Promise<PontoReceita[]> {
  const dias = PERIODOS[periodo].dias;

  const { rows } = await getBanco().execute({
    sql: `SELECT date(pago_em) AS dia, SUM(valor_centavos) AS total
          FROM vendas
          WHERE status = 'pago' AND pago_em >= date('now', ?)
          GROUP BY dia ORDER BY dia`,
    args: [`-${dias - 1} days`],
  });

  const porDia = new Map(rows.map((r) => [String(r.dia), Number(r.total)]));
  const serie: PontoReceita[] = [];
  const hoje = new Date();

  for (let i = dias - 1; i >= 0; i -= 1) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const chave = d.toISOString().slice(0, 10);
    serie.push({ dia: chave, centavos: porDia.get(chave) ?? 0 });
  }

  return serie;
}

/**
 * Recebido hoje e ontem, para o painel-herói e a variação.
 *
 * Só o que está `pago`. A comparação com ontem é o número que a
 * referência mostra como "+63% vs ontem" — e ela fica nula quando ontem
 * foi zero, porque "+∞%" não é informação.
 */
export async function obterHojeEOntem(): Promise<{
  hojeCentavos: number;
  ontemCentavos: number;
  vendasHoje: number;
  variacao: number | null;
}> {
  const { rows } = await getBanco().execute(`
    SELECT
      COALESCE(SUM(CASE WHEN date(pago_em) = date('now')            THEN valor_centavos END), 0) AS hoje,
      COALESCE(SUM(CASE WHEN date(pago_em) = date('now', '-1 day')  THEN valor_centavos END), 0) AS ontem,
      COALESCE(SUM(CASE WHEN date(pago_em) = date('now')            THEN 1 END), 0)              AS n_hoje
    FROM vendas WHERE status = 'pago'
  `);

  const hoje = Number(rows[0]?.hoje ?? 0);
  const ontem = Number(rows[0]?.ontem ?? 0);

  return {
    hojeCentavos: hoje,
    ontemCentavos: ontem,
    vendasHoje: Number(rows[0]?.n_hoje ?? 0),
    variacao: ontem > 0 ? Math.round(((hoje - ontem) / ontem) * 100) : null,
  };
}

export async function listarVendas(limite = 30): Promise<Venda[]> {
  const { rows } = await getBanco().execute({
    sql: `SELECT id, produto_id, lead_id, descricao, valor_centavos, moeda, status, origem,
                 meio_pagamento, stripe_session_id, cliente_email, cliente_nome, criado_em, pago_em
          FROM vendas
          ORDER BY COALESCE(pago_em, criado_em) DESC
          LIMIT ?`,
    args: [limite],
  });
  return rows as unknown as Venda[];
}
