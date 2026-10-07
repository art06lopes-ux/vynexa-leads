import { getBanco, planos } from "@/db/cliente";
import { json, rota } from "@/server/api";

export const GET = rota(async (req) => {
  const url = new URL(req.url);
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 30, 1), 200);
  const banco = getBanco();
  const [{ rows }, { rows: n }] = await Promise.all([
    banco.execute({
      sql: `SELECT id, tipo, titulo, corpo, link, dados, lida_em, criado_em FROM notificacoes ORDER BY criado_em DESC, rowid DESC LIMIT ?`,
      args: [limite],
    }),
    banco.execute(`SELECT COUNT(*) AS n FROM notificacoes WHERE lida_em IS NULL`),
  ]);
  return json({ itens: planos(rows), naoLidas: Number(n[0]?.n ?? 0) });
});
