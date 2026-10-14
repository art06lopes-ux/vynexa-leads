import { z } from "zod";

import { excluirPrompt, marcarFavorito } from "@/db/prompts";
import { ErroApi, json, lerCorpo, rota } from "@/server/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = rota(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { favorito } = await lerCorpo(req, z.object({ favorito: z.boolean() }));
  if (!(await marcarFavorito(id, favorito))) throw new ErroApi("Prompt não encontrado.", 404);
  return json({ ok: true });
});

export const DELETE = rota(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await excluirPrompt(id))) throw new ErroApi("Prompt não encontrado.", 404);
  return json({ ok: true });
});
