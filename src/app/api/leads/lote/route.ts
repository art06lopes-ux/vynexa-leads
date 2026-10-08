import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { json, lerCorpo, limitar, rota } from "@/server/api";
import { ListaIds } from "@/server/esquemas";
import { mudarEtapa, registrarResposta } from "@/services/acoes-lead";
import { ETAPAS } from "@/services/crm";
import { marcarNaoContatar } from "@/services/supressao";

/**
 * Ações em lote da barra de seleção: marcar que responderam, mover de
 * etapa no CRM, não contatar. Uma empresa que falha não para as outras;
 * a resposta diz quantas deram certo.
 */
export const maxDuration = 60;

const Corpo = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("respondeu"), leadIds: ListaIds }),
  z.object({ acao: z.literal("etapa"), leadIds: ListaIds, etapa: z.enum(ETAPAS as [string, ...string[]]) }),
  z.object({ acao: z.literal("nao_contatar"), leadIds: ListaIds }),
]);

export const POST = rota(async (req) => {
  await limitar("lote", 60, 3600);
  const c = await lerCorpo(req, Corpo);
  const banco = getBanco();
  let feitos = 0;

  if (c.acao === "nao_contatar") {
    const { rows } = await banco.execute({
      sql: `SELECT empresa_id FROM leads WHERE id IN (${c.leadIds.map(() => "?").join(",")})`,
      args: c.leadIds,
    });
    for (const r of rows) {
      await marcarNaoContatar(banco, String(r.empresa_id), "Marcado em lote em Leads", "manual");
      feitos += 1;
    }
    return json({ feitos });
  }

  for (const id of c.leadIds) {
    try {
      if (c.acao === "respondeu") await registrarResposta(banco, id);
      else await mudarEtapa(banco, id, c.etapa as never);
      feitos += 1;
    } catch {
      /* lead apagado no meio do caminho: segue com os outros */
    }
  }
  return json({ feitos });
});
