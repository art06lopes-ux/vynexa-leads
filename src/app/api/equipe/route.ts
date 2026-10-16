import { z } from "zod";

import { json, lerCorpo, limitar, respostaDeErro } from "@/server/api";
import { exigirSessaoNaApi, sessaoAtual } from "@/server/sessao";
import { adicionarMembro, removerMembro } from "@/services/contas";

/** Equipe da conta: só o titular adiciona e remove. O dono do SaaS usa o painel de membros. */

async function titular() {
  const negado = await exigirSessaoNaApi();
  if (negado) return { negado, contaId: "" };
  const s = (await sessaoAtual())!;
  if (s.ehDono) return { negado: Response.json({ erro: "Use o painel de membros." }, { status: 400 }), contaId: "" };
  if (s.usuario.papel !== "dono") return { negado: Response.json({ erro: "Só o titular da conta mexe na equipe." }, { status: 403 }), contaId: "" };
  return { negado: null, contaId: s.conta.id };
}

const Novo = z.object({ nome: z.string().trim().min(2, "Informe o nome.").max(80), email: z.string().trim().max(160), senha: z.string().max(200) });
const Remover = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  const { negado, contaId } = await titular();
  if (negado) return negado;
  try {
    await limitar("equipe", 20, 3600);
    await adicionarMembro(contaId, await lerCorpo(req, Novo));
    return json({ ok: true }, 201);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function DELETE(req: Request) {
  const { negado, contaId } = await titular();
  if (negado) return negado;
  try {
    const { id } = await lerCorpo(req, Remover);
    await removerMembro(contaId, id);
    return json({ ok: true });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
