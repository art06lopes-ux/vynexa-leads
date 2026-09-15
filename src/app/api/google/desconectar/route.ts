import { desconectar } from "@/lib/google/oauth";
import { exigirSessaoNaApi } from "@/server/sessao";

export async function POST() {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;
  await desconectar();
  return Response.json({ ok: true });
}
