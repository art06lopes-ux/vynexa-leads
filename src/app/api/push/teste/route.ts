import { notificarTodos } from "@/lib/push/enviar";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Notificação de teste para todos os aparelhos ativados.
 *
 * Existe para conferir a ligação sem precisar registrar uma venda falsa
 * — que depois teria de ser apagada e ainda bagunçaria o painel.
 */
export async function POST() {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const resultado = await notificarTodos({
    titulo: "Vynexa Leads · teste",
    corpo: "Se você está lendo isto no celular, as notificações estão funcionando.",
    url: "/ajustes",
  });

  return Response.json(resultado);
}
