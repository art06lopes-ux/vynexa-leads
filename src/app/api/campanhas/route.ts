import { z } from "zod";

import { criarCampanha } from "@/db/campanhas";
import { contaConectada } from "@/lib/google/oauth";
import { exigirSessaoNaApi } from "@/server/sessao";

const Esquema = z.object({
  nome: z.string().trim().min(3).max(120),
  descricao: z.string().trim().max(300).nullish(),
  empresaIds: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * Cria a campanha e enfileira a geração dos e-mails. Não envia nada
 * aqui: geração e envio acontecem no worker, em lotes, com pausa.
 */
export async function POST(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  // Sem Gmail conectado a campanha nasceria e travaria no envio. Melhor
  // recusar aqui, com a instrução do que fazer.
  if ((await contaConectada()) === null) {
    return Response.json(
      { erro: "Conecte uma conta Google em Ajustes antes de criar campanhas." },
      { status: 409 },
    );
  }

  const analise = Esquema.safeParse(await request.json().catch(() => null));
  if (!analise.success) {
    return Response.json({ erro: analise.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const resultado = await criarCampanha(analise.data);

  if (resultado.incluidas === 0) {
    return Response.json(
      { erro: "Nenhuma das empresas escolhidas tem e-mail. A campanha não foi criada." },
      { status: 400 },
    );
  }

  return Response.json(resultado, { status: 201 });
}
