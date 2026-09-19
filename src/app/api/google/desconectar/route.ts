import { ehLimiteDiarioD1, MENSAGEM_COTA_D1 } from "@/db/cliente";
import { desconectar } from "@/lib/google/oauth";
import { exigirSessaoNaApi } from "@/server/sessao";

export async function POST() {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  try {
    await desconectar();
  } catch (erro) {
    if (!ehLimiteDiarioD1(erro)) throw erro;
    return Response.json({ erro: MENSAGEM_COTA_D1 }, { status: 503 });
  }

  return Response.json({ ok: true });
}
