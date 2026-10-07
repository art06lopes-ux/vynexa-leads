import { after } from "next/server";

import { agora, getBanco, novoId } from "@/db/cliente";
import { acharSegmento } from "@/lib/osm/segmentos";
import { obterProvedor } from "@/integrations/leads";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { NovaBusca } from "@/server/esquemas";
import { executarAgora } from "@/worker/fila";

/**
 * Cria uma busca e começa a executá-la na hora.
 *
 * A busca nasce com um job na fila. Logo depois da resposta, `after()`
 * tenta processá-lo aqui mesmo (até `maxDuration`); se a função for
 * cortada no meio, o job volta à fila e o worker termina. Os dois usam
 * a mesma reserva, então nunca processam a mesma busca duas vezes.
 */
export const maxDuration = 60;

export const POST = rota(async (req) => {
  await limitar("buscas", 40, 3600);
  const b = await lerCorpo(req, NovaBusca);

  const provedor = obterProvedor(b.provedor);
  if (!(await provedor.disponivel())) {
    throw new ErroApi(
      b.provedor === "google_places"
        ? "A Google Places API ainda não está configurada. Cole a chave em Configurações → Integrações, ou busque pelo OpenStreetMap."
        : "O provedor não está disponível.",
      409,
      "sem_configuracao",
    );
  }

  // OpenStreetMap: a caçada completa (expansão de raio + Receita Federal)
  // continua no job antigo, que exige um segmento da lista.
  let tipoJob = "busca_google";
  let segmento = b.termo;
  if (b.provedor === "osm") {
    const achado =
      acharSegmento(b.termo) ??
      acharSegmento(b.termo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/s$/, "").replace(/\s+/g, "_"));
    if (!achado) {
      throw new ErroApi(`O OpenStreetMap só busca segmentos da lista (barbearia, estética, clínica…). Para "${b.termo}", use o Google Maps.`, 422);
    }
    if (!b.pais) throw new ErroApi("Escolha o país para buscar no OpenStreetMap.", 422);
    tipoJob = "busca";
    segmento = achado.slug;
  }

  const banco = getBanco();
  const buscaId = novoId();
  const jobId = novoId();
  await banco.batch(
    [
      {
        sql: `INSERT INTO buscas (id, segmento, pais, estado, cidade, bairro, cep, provedor, consulta_natural, rotulo_resolvido,
                                  raio_km, centro_lat, centro_lng, filtros, status, etapa_atual, criado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
        args: [
          buscaId, segmento, b.pais ?? "ZZ", b.estado ?? null, b.cidade ?? null, b.bairro ?? null, b.cep ?? null, b.provedor,
          b.consultaNatural ?? null, b.local ?? null, b.raioKm ?? null, b.centro?.lat ?? null, b.centro?.lng ?? null,
          JSON.stringify({ ...b.filtros, retangulo: b.retangulo ?? null, maxRequisicoes: b.maxRequisicoes }),
          b.provedor === "osm" ? "Consultando OpenStreetMap…" : "Consultando Google Maps…", agora(),
        ],
      },
      {
        sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, ?, ?, 'pendente')`,
        args: [jobId, tipoJob, JSON.stringify(tipoJob === "busca" ? { buscaId, alvo: 0 } : { buscaId })],
      },
    ],
    "write",
  );

  after(() => executarAgora(getBanco(), jobId));
  return json({ id: buscaId }, 202);
});
