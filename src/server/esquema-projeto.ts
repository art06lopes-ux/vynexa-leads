import { z } from "zod";

import { STATUS_PROJETO, TIPOS_PROJETO } from "@/lib/projetos";
import { paraCentavos } from "@/lib/pagamento/dinheiro";
import { ErroApi } from "@/server/erros";

/** Campos de projeto aceitos na criação e na edição. */
export const CamposProjeto = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao projeto.").max(120),
  leadId: z.string().trim().max(64).nullable().optional(),
  clienteNome: z.string().trim().max(160).nullable().optional(),
  tipo: z.enum(TIPOS_PROJETO),
  status: z.enum(STATUS_PROJETO),
  url: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .transform((u) => (u === undefined ? undefined : u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : null))
    .refine((u) => !u || /^https?:\/\/[^\s/]+\.[^\s]+/.test(u), "Endereço do site inválido."),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  valor: z.string().trim().max(20).optional(),
  custo: z.string().trim().max(20).optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export function centavos(texto: string | undefined, campo: string): number | undefined {
  if (texto === undefined) return undefined;
  if (texto.trim() === "") return 0;
  const v = paraCentavos(texto);
  if (v === null || v < 0) throw new ErroApi(`${campo} inválido.`, 422);
  return v;
}
