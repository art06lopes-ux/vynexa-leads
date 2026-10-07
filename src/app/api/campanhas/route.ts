import { after } from "next/server";
import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { ehProvedorEmail } from "@/integrations/email";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { ListaIds } from "@/server/esquemas";
import { criarCampanha } from "@/services/campanhas";
import { executarAgora } from "@/worker/fila";

export const maxDuration = 60;

const Corpo = z.object({
  nome: z.string().trim().min(3).max(120),
  descricao: z.string().trim().max(500).nullable().optional(),
  leadIds: ListaIds,
  filtros: z.record(z.string(), z.unknown()).nullable().optional(),
  provedorEmail: z.string(),
  ritmoPorHora: z.number().int().min(1).max(120),
  limiteDiario: z.number().int().min(1).max(500),
  followupDias: z.array(z.number().int().min(1).max(60)).max(3),
});

/** Cria a campanha e começa a preparar os e-mails (IA) na hora. */
export const POST = rota(async (req) => {
  await limitar("campanhas", 30, 3600);
  const c = await lerCorpo(req, Corpo);
  if (!ehProvedorEmail(c.provedorEmail)) throw new ErroApi("Provedor de e-mail inválido.");
  const banco = getBanco();
  const r = await criarCampanha(banco, {
    nome: c.nome,
    descricao: c.descricao ?? null,
    leadIds: c.leadIds,
    filtros: c.filtros ?? null,
    provedorEmail: c.provedorEmail,
    ritmoPorHora: c.ritmoPorHora,
    limiteDiario: c.limiteDiario,
    followupDias: c.followupDias,
  });

  // Começa a preparar já; o worker termina o que não couber em 45 s.
  const { rows } = await banco.execute({
    sql: `SELECT id FROM jobs WHERE tipo = 'preparar_campanha' AND status = 'pendente' AND payload LIKE ? LIMIT 1`,
    args: [`%${r.id}%`],
  });
  if (rows[0]) {
    const jobId = String(rows[0].id);
    await banco.execute({ sql: `UPDATE jobs SET payload = ? WHERE id = ?`, args: [JSON.stringify({ campanhaId: r.id, orcamentoMs: 45_000 }), jobId] });
    after(() => executarAgora(getBanco(), jobId));
  }
  return json(r, 201);
});
