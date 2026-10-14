import { ErroNominatim, resolverTexto } from "@/lib/osm/nominatim";
import { ErroApi, json, limitar, rota } from "@/server/api";

/**
 * "Ir ao local" do Radar: endereço livre → centro e caixa do lugar.
 * Gratuito (Nominatim), não gasta requisição do Google.
 */
export const GET = rota(async (req) => {
  await limitar("geo-lugar", 60, 3600);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 160) throw new ErroApi("Digite um bairro, cidade ou endereço.", 422);
  try {
    const l = await resolverTexto(q);
    return json({ rotulo: l.rotulo, lat: l.latitude, lng: l.longitude, bbox: l.bbox });
  } catch (e) {
    if (e instanceof ErroNominatim) throw new ErroApi(e.message, 404);
    throw e;
  }
});
