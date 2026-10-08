import { z } from "zod";

import { carregarFila } from "@/db/abordar";
import { getBanco } from "@/db/cliente";
import { json, lerCorpo, rota } from "@/server/api";

/** Fila de abordagem para uma busca ou para uma seleção de leads. */
const Corpo = z.object({
  buscaId: z.string().max(64).nullable().optional(),
  leadIds: z.array(z.string().max(64)).max(1000).nullable().optional(),
});

export const POST = rota(async (req) => {
  const c = await lerCorpo(req, Corpo);
  return json({ itens: await carregarFila(getBanco(), c) });
});
