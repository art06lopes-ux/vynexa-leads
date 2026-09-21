import { ErroNominatim, resolverLugar } from "@/lib/osm/nominatim";
import { contarPorSegmento, ErroOverpass } from "@/lib/osm/overpass";
import { rotuloDoSegmento, SEGMENTOS } from "@/lib/osm/segmentos";
import { exigirSessaoNaApi } from "@/server/sessao";

// Padrão da Vercel (10s) não basta: a Overpass sozinha já tem até 42s de
// orçamento para contar 45 segmentos numa região. Dentro do teto do
// plano Hobby (60s), com folga para o Nominatim antes dela.
export const maxDuration = 55;

/**
 * Ranking de segmentos por quantidade de estabelecimentos mapeados no
 * OpenStreetMap na região — o "Nichos com mais chance" para fora do
 * Brasil, onde não há base da Receita para contar. Ver `nichosPorRegiao`
 * em `src/db/receita.ts`, a versão brasileira do mesmo painel.
 */
export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const params = new URL(request.url).searchParams;
  const pais = (params.get("pais") ?? "").trim();
  const estado = params.get("estado")?.trim() || null;
  const cidade = params.get("cidade")?.trim() || null;

  if (pais === "") {
    return Response.json({ erro: "Informe o país." }, { status: 400 });
  }

  // Sem cidade nem estado a área é o país inteiro, e a Overpass estoura o
  // timeout de 25s contando 45 segmentos nisso — o mesmo motivo que faz
  // "Brasil inteiro" pular o OSM na caçada de verdade. Aqui é só um
  // painel de apoio: melhor pedir para estreitar do que travar a tela.
  if (!estado && !cidade) {
    return Response.json(
      { erro: "Informe estado/região ou cidade para ver os nichos com mais chance." },
      { status: 400 },
    );
  }

  try {
    const lugar = await resolverLugar({ pais, estado, cidade });
    const contagem = await contarPorSegmento(SEGMENTOS, lugar.bbox);

    const totalGeral = Array.from(contagem.values()).reduce((a, b) => a + b, 0);
    const nichos = Array.from(contagem.entries())
      .map(([slug, total]) => ({
        slug,
        rotulo: rotuloDoSegmento(slug),
        total,
        participacao: totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return Response.json({ nichos });
  } catch (erro) {
    const status = erro instanceof ErroNominatim || erro instanceof ErroOverpass ? 502 : 500;
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao consultar o OpenStreetMap." },
      { status },
    );
  }
}
