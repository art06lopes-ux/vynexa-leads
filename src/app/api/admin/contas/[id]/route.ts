import { z } from "zod";

import { ErroApi, json, lerCorpo, respostaDeErro } from "@/server/api";
import { exigirDonoNaApi } from "@/server/sessao";
import { excluirConta, usuariosDaConta } from "@/services/admin";
import { cancelarAssinatura } from "@/services/assinatura";
import { atualizarConta, estenderValidade, lerConta, provisionarBanco } from "@/services/contas";

/** Ações do dono sobre a conta de um assinante (painel de membros). */

const Patch = z.object({
  plano: z.enum(["essencial", "pro", "agencia"]).optional(),
  status: z.enum(["teste", "ativa", "atrasada", "cancelada", "bloqueada"]).optional(),
  estenderDias: z.number().int().min(-365).max(365).optional(),
  observacao: z.string().max(2000).nullable().optional(),
});

const Post = z.object({ acao: z.enum(["provisionar", "cancelar_assinatura"]) });
const Delete = z.object({ confirmacao: z.literal("EXCLUIR", { message: "Digite EXCLUIR para confirmar." }) });

type Ctx = { params: Promise<{ id: string }> };

async function contaOu404(id: string) {
  const conta = await lerConta(id);
  if (!conta || id === "principal") throw new ErroApi("Conta não encontrada.", 404);
  return conta;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const negado = await exigirDonoNaApi();
  if (negado) return negado;
  try {
    const { id } = await ctx.params;
    const conta = await contaOu404(id);
    const b = await lerCorpo(req, Patch);
    await atualizarConta(id, {
      ...(b.plano ? { plano: b.plano } : {}),
      ...(b.status ? { status: b.status, ...(b.status === "cancelada" ? {} : { cancelada_em: null }) } : {}),
      ...(b.estenderDias ? { valida_ate: estenderValidade(conta.valida_ate, b.estenderDias) } : {}),
      ...(b.observacao !== undefined ? { observacao: b.observacao } : {}),
    });
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const negado = await exigirDonoNaApi();
  if (negado) return negado;
  try {
    const { id } = await ctx.params;
    const conta = await contaOu404(id);
    const { acao } = await lerCorpo(req, Post);
    if (acao === "provisionar") {
      if (conta.banco_tipo !== "pendente") throw new ErroApi("Esta conta já tem banco.", 409);
      const titular = (await usuariosDaConta(id)).find((u) => u.papel === "dono");
      await provisionarBanco(id, { empresa: conta.nome, responsavel: titular?.nome ?? conta.nome, email: titular?.email ?? "", telefone: conta.telefone });
    } else {
      await cancelarAssinatura(id, "Cancelado pelo administrador.");
    }
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const negado = await exigirDonoNaApi();
  if (negado) return negado;
  try {
    const { id } = await ctx.params;
    await contaOu404(id);
    await lerCorpo(req, Delete);
    await excluirConta(id);
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
