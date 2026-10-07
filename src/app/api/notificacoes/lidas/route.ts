import { z } from "zod";

import { agora, getBanco } from "@/db/cliente";
import { json, lerCorpo, rota } from "@/server/api";

const Corpo = z.union([z.object({ todas: z.literal(true) }), z.object({ ids: z.array(z.string().max(64)).min(1).max(90) })]);

export const POST = rota(async (req) => {
  const corpo = await lerCorpo(req, Corpo);
  const banco = getBanco();
  if ("todas" in corpo) {
    await banco.execute({ sql: `UPDATE notificacoes SET lida_em = ? WHERE lida_em IS NULL`, args: [agora()] });
  } else {
    await banco.execute({
      sql: `UPDATE notificacoes SET lida_em = ? WHERE lida_em IS NULL AND id IN (${corpo.ids.map(() => "?").join(",")})`,
      args: [agora(), ...corpo.ids],
    });
  }
  return json({ ok: true });
});
