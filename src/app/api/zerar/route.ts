import { z } from "zod";

import { ehLimiteDiarioD1, getBanco } from "@/db/cliente";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { zerarDados } from "@/services/zerar";

/**
 * Começar do zero (Configurações → Avançado). A tela chama em sequência
 * até `concluido`; cada chamada trabalha no máximo ~45 s.
 */
export const maxDuration = 60;

const Corpo = z.object({
  confirmacao: z.literal("ZERAR", { message: "Digite ZERAR para confirmar." }),
  incluirVendas: z.boolean().default(false),
});

export const POST = rota(async (req) => {
  await limitar("zerar", 60, 3600);
  const { incluirVendas } = await lerCorpo(req, Corpo);
  try {
    return json(await zerarDados(getBanco(), { incluirVendas, orcamentoMs: 45_000 }));
  } catch (erro) {
    if (ehLimiteDiarioD1(erro)) {
      throw new ErroApi(
        "A cota diária de escrita do banco (Cloudflare D1, plano gratuito) acabou no meio da limpeza. O que já foi apagado ficou apagado; depois das 20h (horário de Manaus) toque em \"Zerar\" de novo para terminar.",
        503,
      );
    }
    throw erro;
  }
});
