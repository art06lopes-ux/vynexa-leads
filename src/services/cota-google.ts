import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";

/**
 * Trava mensal de requisições à Google Places API, dentro do app.
 *
 * O Google dá 1.000 Text Search (Enterprise) grátis por mês e cobra o que
 * passar. A trava diária no Google Cloud é a primeira proteção; esta é a
 * segunda, e vale mesmo se aquela não existir: o app para de buscar ao
 * chegar no limite (900 por padrão, com folga). O uso fica num contador
 * por mês em `configuracoes` — e não somado das buscas, porque "Começar
 * do zero" apaga as buscas e zeraria a conta junto.
 */

export const LIMITE_MENSAL_PADRAO = 900;

export function chaveDoMes(data = new Date()): string {
  return `google_uso_${data.toISOString().slice(0, 7)}`;
}

export async function usoGoogle(banco: Client, data = new Date()): Promise<{ usadas: number; limite: number; restantes: number }> {
  const { rows } = await banco.execute({
    sql: `SELECT chave, valor FROM configuracoes WHERE chave IN (?, 'google_limite_mensal')`,
    args: [chaveDoMes(data)],
  });
  const valor = (c: string) => rows.find((r) => r.chave === c)?.valor;
  const usadas = Number(valor(chaveDoMes(data)) ?? 0) || 0;
  const limiteBruto = Number(valor("google_limite_mensal"));
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 ? limiteBruto : LIMITE_MENSAL_PADRAO;
  return { usadas, limite, restantes: Math.max(0, limite - usadas) };
}

export async function registrarUsoGoogle(banco: Client, requisicoes: number, data = new Date()): Promise<void> {
  if (requisicoes <= 0) return;
  await banco.execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = CAST(COALESCE(configuracoes.valor, '0') AS INTEGER) + ?, atualizado_em = excluded.atualizado_em`,
    args: [chaveDoMes(data), String(requisicoes), agora(), requisicoes],
  });
}
