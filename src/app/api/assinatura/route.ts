import { z } from "zod";

import { json, lerCorpo, limitar, respostaDeErro } from "@/server/api";
import { exigirSessaoNaApi, sessaoAtual } from "@/server/sessao";
import { cancelarAssinatura, iniciarAssinatura } from "@/services/assinatura";

/**
 * Assinar / trocar de plano (POST) e cancelar (DELETE). Abre mesmo com a
 * assinatura vencida — é justamente para regularizar. Só o dono da conta
 * (papel "dono"), não os membros da equipe.
 */

const Corpo = z.object({
  plano: z.enum(["essencial", "pro", "agencia"]),
  documento: z.string().min(11, "Informe o CPF ou CNPJ.").max(20),
});

async function exigirTitular() {
  const negado = await exigirSessaoNaApi({ mesmoVencida: true });
  if (negado) return { negado, sessao: null };
  const sessao = (await sessaoAtual())!;
  if (sessao.ehDono) return { negado: Response.json({ erro: "A conta do dono não tem assinatura." }, { status: 400 }), sessao: null };
  if (sessao.usuario.papel !== "dono") return { negado: Response.json({ erro: "Só o titular da conta mexe na assinatura." }, { status: 403 }), sessao: null };
  return { negado: null, sessao };
}

export async function POST(req: Request) {
  const { negado, sessao } = await exigirTitular();
  if (negado) return negado;
  try {
    await limitar("assinatura", 10, 3600);
    const b = await lerCorpo(req, Corpo);
    const r = await iniciarAssinatura({
      conta: sessao!.conta,
      plano: b.plano,
      documento: b.documento,
      email: sessao!.usuario.email ?? "",
      nome: sessao!.usuario.nome,
      telefone: sessao!.conta.telefone,
    });
    return json(r);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function DELETE() {
  const { negado, sessao } = await exigirTitular();
  if (negado) return negado;
  try {
    await cancelarAssinatura(sessao!.conta.id, `Cancelado pelo cliente (${sessao!.usuario.email}).`);
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
