import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { json, lerCorpo, rota } from "@/server/api";
import { ListaIds } from "@/server/esquemas";

/** Quantos da seleção podem receber e-mail (para a criação de campanha). */
export const POST = rota(async (req) => {
  const { leadIds } = await lerCorpo(req, z.object({ leadIds: ListaIds }));
  const banco = getBanco();
  let comEmail = 0;
  let bloqueados = 0;
  let emNegociacao = 0;
  const categorias = new Map<string, number>();
  const cidades = new Map<string, number>();
  for (let i = 0; i < leadIds.length; i += 90) {
    const lote = leadIds.slice(i, i + 90);
    const { rows } = await banco.execute({
      sql: `SELECT e.email, e.nao_contatar, l.etapa, COALESCE(e.categoria_rotulo, e.categoria) cat, e.cidade
            FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE l.id IN (${lote.map(() => "?").join(",")})`,
      args: lote,
    });
    for (const r of rows) {
      if (Number(r.nao_contatar) === 1) bloqueados += 1;
      else if (["negociacao", "proposta", "fechado", "perdido"].includes(String(r.etapa))) emNegociacao += 1;
      else if (r.email) comEmail += 1;
      categorias.set(String(r.cat), (categorias.get(String(r.cat)) ?? 0) + 1);
      if (r.cidade) cidades.set(String(r.cidade), (cidades.get(String(r.cidade)) ?? 0) + 1);
    }
  }
  const topo = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return json({ total: leadIds.length, comEmail, bloqueados, emNegociacao, categoria: topo(categorias), cidade: topo(cidades) });
});
