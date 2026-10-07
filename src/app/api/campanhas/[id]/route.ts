import { after } from "next/server";
import { z } from "zod";

import { getBanco, novoId } from "@/db/cliente";
import { ehProvedorEmail, provedorEmail } from "@/integrations/email";
import { ErroApi, json, lerCorpo, rota } from "@/server/api";
import { autorizarCampanha, cancelarCampanha, editarEnvio, pausarCampanha } from "@/services/campanhas";
import { executarAgora } from "@/worker/fila";

export const maxDuration = 60;

const Corpo = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("autorizar"), quando: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).nullable() }),
  z.object({ acao: z.literal("pausar") }),
  z.object({ acao: z.literal("cancelar") }),
  z.object({ acao: z.literal("preparar") }),
  z.object({ acao: z.literal("editar_envio"), envioId: z.string().max(64), assunto: z.string().max(150), corpo: z.string().max(6000) }),
]);

export const POST = rota(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const c = await lerCorpo(req, Corpo);
  const banco = getBanco();
  const { rows } = await banco.execute({ sql: `SELECT status, provedor_email FROM campanhas WHERE id = ?`, args: [id] });
  if (!rows[0]) throw new ErroApi("Campanha não encontrada.", 404);

  switch (c.acao) {
    case "autorizar": {
      const prov = String(rows[0].provedor_email);
      if (ehProvedorEmail(prov)) {
        const pronto = await provedorEmail(prov).pronto();
        if (!pronto.ok) throw new ErroApi(`O provedor de e-mail (${prov}) não está pronto: ${pronto.motivo}`, 409, "sem_configuracao");
      }
      await autorizarCampanha(banco, id, c.quando);
      // Envio imediato: começa já, no ritmo; o worker continua.
      if (!c.quando) {
        const { rows: j } = await banco.execute({
          sql: `SELECT id FROM jobs WHERE tipo = 'enviar_campanha' AND status = 'pendente' AND payload LIKE ? ORDER BY criado_em DESC LIMIT 1`,
          args: [`%${id}%`],
        });
        if (j[0]) {
          const jobId = String(j[0].id);
          await banco.execute({ sql: `UPDATE jobs SET payload = ? WHERE id = ?`, args: [JSON.stringify({ campanhaId: id, orcamentoMs: 40_000 }), jobId] });
          after(() => executarAgora(getBanco(), jobId));
        }
      }
      return json({ ok: true });
    }
    case "pausar":
      await pausarCampanha(banco, id);
      return json({ ok: true });
    case "cancelar":
      await cancelarCampanha(banco, id);
      return json({ ok: true });
    case "preparar": {
      // Gera de novo os textos que falharam (ex.: IA configurada depois).
      await banco.execute({ sql: `UPDATE envios SET status = 'pendente', erro = NULL WHERE campanha_id = ? AND status = 'erro' AND enviado_em IS NULL`, args: [id] });
      await banco.execute({ sql: `UPDATE campanhas SET status = 'preparando' WHERE id = ? AND status IN ('pronta','rascunho')`, args: [id] });
      const jobId = novoId();
      await banco.execute({ sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'preparar_campanha', ?, 'pendente')`, args: [jobId, JSON.stringify({ campanhaId: id, orcamentoMs: 45_000 })] });
      after(() => executarAgora(getBanco(), jobId));
      return json({ ok: true });
    }
    case "editar_envio":
      await editarEnvio(banco, c.envioId, c.assunto, c.corpo);
      return json({ ok: true });
  }
});
