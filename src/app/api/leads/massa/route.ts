import { after } from "next/server";
import { z } from "zod";

import { getBanco, novoId } from "@/db/cliente";
import { obterIA } from "@/integrations/ai";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { ListaIds } from "@/server/esquemas";
import { executarAgora } from "@/worker/fila";

/**
 * Modo em massa: "Analisar selecionados" e "Gerar mensagens".
 * Enfileira e já começa (até ~50 s aqui; o worker continua o resto).
 */
export const maxDuration = 60;

const Corpo = z.object({ leadIds: ListaIds, analisar: z.boolean(), gerarMensagens: z.boolean() }).refine((c) => c.analisar || c.gerarMensagens, "Escolha analisar e/ou gerar mensagens.");

export const POST = rota(async (req) => {
  await limitar("ia-massa", 30, 3600);
  const c = await lerCorpo(req, Corpo);
  if (!(await obterIA().disponivel())) {
    throw new ErroApi("A IA ainda não está configurada. Cole a chave do Gemini em Configurações → Integrações.", 409, "sem_configuracao");
  }
  const jobId = novoId();
  await getBanco().execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
    args: [jobId, JSON.stringify({ leadIds: c.leadIds, analisar: c.analisar, gerarMensagens: c.gerarMensagens, orcamentoMs: 45_000 })],
  });
  after(() => executarAgora(getBanco(), jobId));
  return json({ enfileirados: c.leadIds.length }, 202);
});
