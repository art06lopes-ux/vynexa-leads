import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Busca, PayloadBusca } from "@/db/tipos";
import { classificarStatusSite } from "@/lib/leads/classificacao";
import { normalizarLocalidade } from "@/lib/geo/localidade";
import { idiomaDoPais } from "@/lib/geo/paises";
import { acharSegmento } from "@/lib/osm/segmentos";
import { expandirBbox, raioAproximadoKm, resolverLugar, type Bbox } from "@/lib/osm/nominatim";
import { buscarEstabelecimentos, type ElementoOsm } from "@/lib/osm/overpass";

/**
 * Degraus da expansão de raio, em quilômetros somados à bbox original.
 *
 * A primeira tentativa usa a área exata que o Nominatim devolveu para a
 * cidade. Se vier pouco resultado, abre em degraus — 8, 25 e 60 km — em
 * vez de já partir para uma área enorme, que traria empresas longe
 * demais para serem prospectadas e ainda castigaria a Overpass.
 *
 * Três degraus e não mais: cada um é uma consulta à Overpass, que é um
 * serviço público e gratuito. Insistir além disso é abuso.
 */
const DEGRAUS_KM = [0, 8, 25, 60];

/** Abaixo disto vale a pena expandir; acima, já é resultado suficiente. */
const FRACAO_ACEITAVEL = 0.6;

/**
 * Quantos resultados novos uma expansão precisa trazer para justificar a
 * próxima. Abrir o raio e ganhar duas empresas significa que o segmento é
 * raro ali — continuar só gasta requisição contra um serviço público.
 */
const GANHO_MINIMO = 3;

/**
 * Teto da consulta quando o operador pede "todas".
 *
 * Não é limite de negócio, é proteção da Overpass: uma consulta sem teto
 * num estado inteiro pode estourar o timeout dela e devolver nada.
 * Manaus inteira, todos os segmentos juntos, deu 757 — cinco mil cobre
 * qualquer cidade do país em um segmento com folga larga.
 */
const TETO_ABSOLUTO = 5000;

export async function processarBusca(banco: Client, payload: PayloadBusca): Promise<string> {
  const { rows } = await banco.execute({
    sql: `SELECT id, segmento, pais, estado, cidade, status FROM buscas WHERE id = ?`,
    args: [payload.buscaId],
  });

  const busca = rows[0] as unknown as Busca | undefined;
  if (!busca) throw new Error(`Busca ${payload.buscaId} não existe.`);

  await banco.execute({
    sql: `UPDATE buscas SET status = 'em_andamento' WHERE id = ?`,
    args: [busca.id],
  });

  const segmento = acharSegmento(busca.segmento);
  if (!segmento) throw new Error(`Segmento desconhecido: ${busca.segmento}`);

  const lugar = await resolverLugar({
    pais: busca.pais,
    estado: busca.estado,
    cidade: busca.cidade,
  });

  // `alvo` 0 significa "todas as empresas mapeadas na região". Aí não há
  // escada de expansão: o operador quer o que existe ali dentro, não o
  // que existe a 60 km. Uma consulta só, com teto alto o bastante para
  // qualquer cidade brasileira em um segmento.
  const todas = payload.alvo === 0;
  const alvo = todas ? Number.POSITIVE_INFINITY : payload.alvo;
  let melhor: ElementoOsm[] = [];
  let bboxUsada: Bbox = lugar.bbox;
  let expansoes = 0;

  for (const km of todas ? [0] : DEGRAUS_KM) {
    const bbox = km === 0 ? lugar.bbox : expandirBbox(lugar.bbox, km);

    // Teto generoso na consulta: o corte para o alvo acontece depois de
    // descartar elementos sem nome e os já conhecidos.
    const { elementos } = await buscarEstabelecimentos(
      [segmento],
      bbox,
      todas ? TETO_ABSOLUTO : Math.max(alvo * 4, 200),
    );

    const ganho = elementos.length - melhor.length;

    if (elementos.length > melhor.length) {
      melhor = elementos;
      bboxUsada = bbox;
    }
    if (km > 0) expansoes += 1;

    // Já tem resultado suficiente: não precisa abrir mais.
    if (elementos.length >= alvo * FRACAO_ACEITAVEL) break;

    // Abrir a área não trouxe praticamente nada de novo, então o segmento
    // é raro naquela região e insistir só gasta slot da Overpass — que
    // limita por IP e responde 429 quando se abusa. Sem esta parada, uma
    // busca por "roofing" em Orlando, onde existem 4 telhadistas
    // mapeados, fazia as quatro consultas da escada toda vez e derrubava
    // o próprio job por excesso de requisições.
    if (km > 0 && ganho < GANHO_MINIMO) break;
  }

  const recorte = todas ? melhor : melhor.slice(0, alvo);
  const conhecidos = await osmIdsConhecidos(
    banco,
    recorte.map((e) => e.osmId),
  );
  const novos = recorte.filter((e) => !conhecidos.has(e.osmId));

  if (novos.length > 0) {
    await inserirEmpresas(banco, busca, novos);

    // Quem tem site próprio e não tem e-mail no OSM ganha uma visita ao
    // site em busca de contato. É de onde sai o e-mail das empresas
    // internacionais. Um job só; ele se reenfileira enquanto houver fila.
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'enriquecer_email', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ limite: 15 })],
    });
  }

  await banco.execute({
    sql: `UPDATE buscas
          SET status = 'concluida',
              rotulo_resolvido = ?,
              bbox_sul = ?, bbox_oeste = ?, bbox_norte = ?, bbox_leste = ?,
              raio_final_km = ?,
              expansoes = ?,
              quantidade_encontrada = ?,
              quantidade_nova = ?,
              concluido_em = ?
          WHERE id = ?`,
    args: [
      lugar.rotulo,
      bboxUsada.sul,
      bboxUsada.oeste,
      bboxUsada.norte,
      bboxUsada.leste,
      raioAproximadoKm(bboxUsada),
      expansoes,
      recorte.length,
      novos.length,
      agora(),
      busca.id,
    ],
  });

  return `${recorte.length} encontradas (${novos.length} novas) em ${lugar.rotulo}`;
}

/**
 * Consulta em lotes.
 *
 * O libSQL monta o `IN (?, ?, …)` com um parâmetro por item, e há um
 * teto de variáveis por statement no SQLite. 200 por vez fica bem abaixo.
 */
async function osmIdsConhecidos(banco: Client, ids: string[]): Promise<Set<string>> {
  const conhecidos = new Set<string>();
  const LOTE = 200;

  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const marcadores = lote.map(() => "?").join(",");
    const { rows } = await banco.execute({
      sql: `SELECT osm_id FROM empresas WHERE osm_id IN (${marcadores})`,
      args: lote,
    });
    for (const linha of rows) conhecidos.add(String(linha.osm_id));
  }

  return conhecidos;
}

async function inserirEmpresas(banco: Client, busca: Busca, novos: ElementoOsm[]): Promise<void> {
  const idioma = idiomaDoPais(busca.pais);

  const statements = novos.map((e) => ({
    // `INSERT OR IGNORE` cobre a corrida em que duas execuções do worker
    // se sobrepõem: a checagem por `osmIdsConhecidos` é uma leitura, não
    // um cadeado, e quem garante de fato é o UNIQUE em `osm_id`.
    sql: `INSERT OR IGNORE INTO empresas (
            id, busca_id, osm_id, nome, pais, estado, cidade, endereco,
            latitude, longitude, telefone, email, email_origem, website,
            instagram, facebook, categoria, idioma_abordagem, status_site
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      novoId(),
      busca.id,
      e.osmId,
      e.nome,
      busca.pais,
      // O endereço da empresa manda, quando existe; o da busca é o
      // reserva. Uma busca por estado inteiro não sabe a cidade de cada
      // empresa, e herdar a da busca inventaria o dado.
      // A normalização só arruma grafia — sem ela o filtro de cidade
      // lista "Belo Horizonte", "Belo Horizonte - MG" e "belo horizonte"
      // como três lugares distintos.
      normalizarLocalidade(e.estado) ?? busca.estado,
      normalizarLocalidade(e.cidade) ?? busca.cidade,
      e.endereco,
      e.latitude,
      e.longitude,
      e.telefone,
      e.email,
      e.email === null ? null : "osm",
      e.website,
      e.instagram,
      e.facebook,
      e.categoria,
      idioma,
      classificarStatusSite(e),
    ] as const,
  }));

  // Em lote: um `execute` por empresa seriam 50 viagens ao Turso.
  await banco.batch(statements.map((s) => ({ sql: s.sql, args: [...s.args] })), "write");
}
