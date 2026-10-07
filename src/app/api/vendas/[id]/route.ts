import { z } from "zod";

import { agora, getBanco } from "@/db/cliente";
import { ErroPagamento } from "@/integrations/pagamentos/asaas";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { confirmarPagamentoManual, emitirCobranca } from "@/services/financeiro";

export const maxDuration = 30;

const Corpo = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("cobranca"),
    forma: z.enum(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]),
    vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    nome: z.string().trim().min(2).max(120),
    documento: z.string().trim().min(11).max(20),
    email: z.string().trim().email().nullable().optional(),
    telefone: z.string().trim().max(40).nullable().optional(),
  }),
  z.object({ acao: z.literal("pago"), meio: z.enum(["pix", "boleto", "cartao", "transferencia", "dinheiro", "outro"]) }),
  z.object({ acao: z.literal("cancelar") }),
]);

export const POST = rota(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const c = await lerCorpo(req, Corpo);
  const banco = getBanco();
  switch (c.acao) {
    case "cobranca": {
      await limitar("asaas", 60, 3600);
      try {
        const r = await emitirCobranca(banco, { vendaId: id, forma: c.forma, vencimento: c.vencimento, nome: c.nome, documento: c.documento, email: c.email ?? null, telefone: c.telefone ?? null });
        return json(r, 201);
      } catch (e) {
        if (e instanceof ErroPagamento) throw new ErroApi(e.message, 422, /não está configurado/.test(e.message) ? "sem_configuracao" : undefined);
        throw e;
      }
    }
    case "pago":
      return json({ mudou: await confirmarPagamentoManual(banco, id, c.meio) });
    case "cancelar":
      await banco.execute({ sql: `UPDATE vendas SET status = 'cancelado' WHERE id = ? AND status IN ('pendente','vencido')`, args: [id] });
      await banco.execute({ sql: `UPDATE cobrancas SET status = 'cancelado', atualizado_em = ? WHERE venda_id = ? AND status = 'pendente'`, args: [agora(), id] });
      return json({ ok: true });
  }
});
