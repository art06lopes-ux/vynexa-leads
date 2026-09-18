import { z } from "zod";

import { ehLimiteDiarioD1 } from "@/db/cliente";
import { criarBuscaComJob } from "@/db/consultas";
import { acharPais } from "@/lib/geo/paises";
import { acharSegmento } from "@/lib/osm/segmentos";
import { exigirSessaoNaApi } from "@/server/sessao";

/**
 * Cria a busca e devolve na hora.
 *
 * Esta rota não consulta a Overpass. O plano Hobby da Vercel corta a
 * função em 10 segundos e uma consulta à Overpass leva de 5 a 60 — fazer
 * o trabalho aqui daria timeout na cara do operador. A rota só enfileira;
 * quem consulta é o worker no GitHub Actions.
 */

const Esquema = z.object({
  segmento: z.string().min(1),
  pais: z.string().length(2),
  estado: z.string().trim().max(80).nullish(),
  cidade: z.string().trim().max(120).nullish(),
  // 0 = todas as empresas mapeadas na região, sem teto de negócio.
  alvo: z.coerce.number().int().min(0).max(500).default(0),
});

export async function POST(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const analise = Esquema.safeParse(corpo);
  if (!analise.success) {
    return Response.json(
      { erro: analise.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { segmento, pais, estado, cidade, alvo } = analise.data;

  // Validar aqui e não só no worker: um segmento inexistente viraria um
  // job que falha seis vezes antes de o operador descobrir o erro.
  if (!acharSegmento(segmento)) {
    return Response.json({ erro: `Segmento desconhecido: ${segmento}` }, { status: 400 });
  }
  if (!acharPais(pais)) {
    return Response.json({ erro: `País não atendido: ${pais}` }, { status: 400 });
  }

  try {
    const buscaId = await criarBuscaComJob({
      segmento,
      pais: pais.toUpperCase(),
      estado: estado?.trim() || null,
      cidade: cidade?.trim() || null,
      alvo,
    });

    return Response.json({ buscaId }, { status: 202 });
  } catch (erro) {
    // Sem isto, o erro virava uma página de erro do Next em vez de JSON,
    // e o formulário mostrava "Falha de rede" — verdade, mas escondia o
    // motivo real (a cota diária do D1, que reseta sozinha à meia-noite
    // UTC) atrás de uma mensagem que parece um problema de conexão.
    if (ehLimiteDiarioD1(erro)) {
      return Response.json(
        {
          erro:
            "O banco atingiu a cota diária de escrita (plano gratuito do Cloudflare D1). " +
            "Ela reseta à meia-noite UTC — tente de novo depois disso.",
        },
        { status: 503 },
      );
    }
    throw erro;
  }
}
