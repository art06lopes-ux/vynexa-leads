import { revalidatePath } from "next/cache";
import { z } from "zod";

import { json, lerCorpo, respostaDeErro } from "@/server/api";
import { exigirDonoNaApi } from "@/server/sessao";
import { salvarConfigSaas } from "@/services/admin";

const Corpo = z.object({
  testeDias: z.number().int().min(0).max(60),
  whatsappSuporte: z.string().trim().max(20),
});

export async function PUT(req: Request) {
  const negado = await exigirDonoNaApi();
  if (negado) return negado;
  try {
    const b = await lerCorpo(req, Corpo);
    await salvarConfigSaas("saas_teste_dias", String(b.testeDias));
    await salvarConfigSaas("saas_whatsapp_suporte", b.whatsappSuporte.replace(/\D/g, ""));
    revalidatePath("/conheca");
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
