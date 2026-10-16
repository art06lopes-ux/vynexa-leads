import { revalidatePath } from "next/cache";
import { z } from "zod";

import { json, lerCorpo, respostaDeErro } from "@/server/api";
import { exigirDonoNaApi } from "@/server/sessao";
import { salvarPlano } from "@/services/contas";

const limite = z.number().int().min(0).max(10_000_000).nullable();

const Corpo = z.object({
  id: z.enum(["essencial", "pro", "agencia"]),
  nome: z.string().trim().min(2).max(40),
  descricao: z.string().trim().max(200),
  precoCentavos: z.number().int().min(500, "O Asaas cobra no mínimo R$ 5,00.").max(10_000_000),
  destaque: z.boolean(),
  limites: z.object({ leads_mes: limite, usuarios: limite, ia_mes: limite }),
});

/** Preço e limites de um plano (o que cada plano libera é fixo no código). */
export async function PUT(req: Request) {
  const negado = await exigirDonoNaApi();
  if (negado) return negado;
  try {
    await salvarPlano(await lerCorpo(req, Corpo));
    revalidatePath("/conheca");
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
