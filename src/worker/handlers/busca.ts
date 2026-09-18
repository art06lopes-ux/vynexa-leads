import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Busca, PayloadBusca } from "@/db/tipos";
import { classificarStatusSite } from "@/lib/leads/classificacao";
import { normalizarLocalidade } from "@/lib/geo/localidade";
import { idiomaDoPais } from "@/lib/geo/paises";
import { acharSegmento, type Segmento } from "@/lib/osm/segmentos";
import { expandirBbox, raioAproximadoKm, resolverLugar, type Bbox } from "@/lib/osm/nominatim";
import { buscarEstabelecimentos, type ElementoOsm } from "@/lib/osm/overpass";
import { abreWhatsapp } from "@/lib/leads/whatsapp";
import { complementarComReceita } from "@/worker/handlers/receita";

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
    sql: `UPDATE buscas SET status = 'em_andamento', erro = NULL WHERE id = ?`,
    args: [busca.id],
  });

  const segmento = acharSegmento(busca.segmento);
  if (!segmento) throw new Error(`Segmento desconhecido: ${busca.segmento}`);

  const todas = payload.alvo === 0;
  const alvo = todas ? Number.POSITIVE_INFINITY : payload.alvo;

  // Continuação de uma caçada grande: o OSM já passou, falta a Receita.
  if (payload.somenteReceita) {
    return continuarReceita(banco, busca, segmento, payload, alvo);
  }

  // "Todo o Brasil": o OSM fica de fora. Uma consulta à Overpass sobre o
  // país inteiro estoura o timeout dela e volta vazia; a base da Receita
  // cobre todos os municípios, interior incluído, sem pedir nada a
  // ninguém. Fora do Brasil não há Receita, então o país inteiro vai ao
  // OSM como sempre.
  const brasilInteiro = busca.pais === "BR" && !busca.estado;

  const lugar = brasilInteiro
    ? null
    : await resolverLugar({
        pais: busca.pais,
        estado: busca.estado,
        cidade: busca.cidade,
      });

  // `alvo` 0 significa "todas as empresas mapeadas na região". Aí não há
  // escada de expansão: o operador quer o que existe ali dentro, não o
  // que existe a 60 km. Uma consulta só, com teto alto o bastante para
  // qualquer cidade brasileira em um segmento.
  let melhor: ElementoOsm[] = [];
  let bboxUsada: Bbox | null = lugar?.bbox ?? null;
  let expansoes = 0;

  for (const km of lugar === null ? [] : todas ? [0] : DEGRAUS_KM) {
    const bbox = km === 0 ? lugar!.bbox : expandirBbox(lugar!.bbox, km);

    // Teto generoso na consulta: o corte para o alvo acontece depois de
    // descartar elementos sem nome e os já conhecidos.
    const { elementos } = await buscarEstabelecimentos(
      [segmento],
      bbox,
      // Pede bem mais que o alvo: parte vai cair no dedup.
      todas ? TETO_ABSOLUTO : Math.max(alvo * 6, 300),
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

  // O teto vale para empresas NOVAS. Repetir "Portugal, 100" depois de
  // "Portugal, 50" traz 100 que ainda não estavam na carteira — e não as
  // mesmas 50 mais 50, como acontecia quando o corte vinha antes do
  // dedup. As já conhecidas não contam nem como "encontradas": o
  // operador quer saber o que ganhou, não o que a Overpass repetiu.
  const conhecidos = await osmIdsConhecidos(
    banco,
    melhor.map((e) => e.osmId),
  );
  const ineditas = melhor.filter((e) => !conhecidos.has(e.osmId));
  const novos = todas ? ineditas : ineditas.slice(0, alvo);
  const recorte = novos;

  if (novos.length > 0) {
    await inserirEmpresas(banco, busca, novos);
  }

  // Segunda fonte, só no Brasil: a base da Receita Federal, se o estado
  // já foi importado. Ela preenche telefone e e-mail de quem o OSM só
  // localizou, e acrescenta quem o OSM nem conhece. Entra depois do OSM
  // de propósito — o casamento por nome precisa das empresas do OSM já
  // gravadas.
  const receita = await complementarComReceita(
    banco,
    busca,
    segmento,
    todas ? Number.MAX_SAFE_INTEGER : Math.max(0, alvo - recorte.length),
    null,
  );

  if (novos.length > 0 || receita.novas > 0) {
    await pedirEnriquecimento(banco);
    await pedirAnalise(banco);
  }

  // O que o OSM trouxe é gravado agora; a parte da Receita é somada por
  // fatia, então os contadores são incrementos e não valores absolutos.
  await banco.execute({
    sql: `UPDATE buscas
          SET rotulo_resolvido = ?,
              bbox_sul = ?, bbox_oeste = ?, bbox_norte = ?, bbox_leste = ?,
              raio_final_km = ?,
              expansoes = ?,
              quantidade_encontrada = quantidade_encontrada + ?,
              quantidade_nova = quantidade_nova + ?,
              quantidade_receita = quantidade_receita + ?
          WHERE id = ?`,
    args: [
      lugar?.rotulo ?? "Brasil (todos os estados)",
      bboxUsada?.sul ?? null,
      bboxUsada?.oeste ?? null,
      bboxUsada?.norte ?? null,
      bboxUsada?.leste ?? null,
      bboxUsada ? raioAproximadoKm(bboxUsada) : null,
      expansoes,
      recorte.length + receita.encontradas,
      novos.length + receita.novas,
      receita.novas,
      busca.id,
    ],
  });

  const continua = await agendarProximaFatia(banco, payload, receita, receita.novas);
  if (!continua) await concluir(banco, busca.id);

  const resumoReceita = receita.disponivel
    ? ` · Receita: ${receita.encontradas} lidas, ${receita.novas} novas, ${receita.enriquecidas} enriquecidas${continua ? " (continua na próxima rodada)" : ""}`
    : busca.pais === "BR"
      ? " · Receita: base ainda não importada"
      : "";
  const resumoOsm = lugar
    ? `OSM: ${recorte.length} encontradas (${novos.length} novas) em ${lugar.rotulo}`
    : "Brasil inteiro (só Receita)";
  return `${resumoOsm}${resumoReceita}`;
}

/** Fatia seguinte da Receita, retomando do cursor gravado no payload. */
async function continuarReceita(
  banco: Client,
  busca: Busca,
  segmento: Segmento,
  payload: PayloadBusca,
  alvo: number,
): Promise<string> {
  const acumulado = payload.receitaAcumulado ?? 0;
  const receita = await complementarComReceita(
    banco,
    busca,
    segmento,
    Number.isFinite(alvo) ? Math.max(0, alvo - acumulado) : Number.MAX_SAFE_INTEGER,
    payload.receitaCursor ?? null,
  );

  if (receita.novas > 0) {
    await pedirEnriquecimento(banco);
    await pedirAnalise(banco);
  }

  await banco.execute({
    sql: `UPDATE buscas
          SET quantidade_encontrada = quantidade_encontrada + ?,
              quantidade_nova = quantidade_nova + ?,
              quantidade_receita = quantidade_receita + ?
          WHERE id = ?`,
    args: [receita.encontradas, receita.novas, receita.novas, busca.id],
  });

  const continua = await agendarProximaFatia(banco, payload, receita, acumulado + receita.novas);
  if (!continua) await concluir(banco, busca.id);

  return `Receita (fatia): ${receita.encontradas} lidas, ${receita.novas} novas, ${receita.enriquecidas} enriquecidas · total ${acumulado + receita.novas}${continua ? " · continua" : " · concluída"}`;
}

async function agendarProximaFatia(
  banco: Client,
  payload: PayloadBusca,
  receita: { proximoCursor: string | null },
  acumulado: number,
): Promise<boolean> {
  if (!receita.proximoCursor) return false;
  const proximo: PayloadBusca = {
    buscaId: payload.buscaId,
    alvo: payload.alvo,
    somenteReceita: true,
    receitaCursor: receita.proximoCursor,
    receitaAcumulado: acumulado,
  };
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'busca', ?, 'pendente')`,
    args: [novoId(), JSON.stringify(proximo)],
  });
  return true;
}

async function concluir(banco: Client, buscaId: string): Promise<void> {
  await banco.execute({
    sql: `UPDATE buscas SET status = 'concluida', concluido_em = ? WHERE id = ?`,
    args: [agora(), buscaId],
  });
}

/**
 * Análise de IA sem clique: toda caçada que trouxe empresa nova já entra
 * na fila do Gemini. A mensagem de abordagem é o que o operador quer ver
 * na linha — esperar que ele descubra o botão "Analisar" era um passo a
 * mais para nada. Um job só; ele se reenfileira enquanto houver empresa.
 */
async function pedirAnalise(banco: Client): Promise<void> {
  const { rows } = await banco.execute(
    `SELECT 1 FROM jobs WHERE tipo = 'analise_ia' AND status IN ('pendente','em_andamento') LIMIT 1`,
  );
  if (rows.length > 0) return;
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
    args: [novoId(), JSON.stringify({ limite: 20 })],
  });
}

/**
 * Quem tem site próprio e não tem e-mail ganha uma visita ao site em
 * busca de contato; quem veio da Receita com e-mail de domínio próprio
 * tem o domínio conferido. Um job só; ele se reenfileira enquanto houver
 * fila — e só entra se não houver um pendente, para não empilhar.
 */
async function pedirEnriquecimento(banco: Client): Promise<void> {
  const { rows } = await banco.execute(
    `SELECT 1 FROM jobs WHERE tipo = 'enriquecer_email' AND status = 'pendente' LIMIT 1`,
  );
  if (rows.length > 0) return;
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'enriquecer_email', ?, 'pendente')`,
    args: [novoId(), JSON.stringify({ limite: 15 })],
  });
}

/**
 * Consulta em lotes.
 *
 * O `IN (?, ?, …)` monta um parâmetro por item, e o D1 tem um teto de
 * 100 parâmetros por statement — bem mais apertado que o SQLite puro
 * (999) para o qual isto foi escrito originalmente. 100 é o máximo.
 */
async function osmIdsConhecidos(banco: Client, ids: string[]): Promise<Set<string>> {
  const conhecidos = new Set<string>();
  const LOTE = 100;

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
            id, busca_id, fonte, osm_id, nome, pais, estado, cidade, endereco,
            latitude, longitude, telefone, telefone_origem, email, email_origem, website,
            instagram, facebook, categoria, idioma_abordagem, status_site, whatsapp
          ) VALUES (?,?,'osm',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      e.telefone === null ? null : "osm",
      e.email,
      e.email === null ? null : "osm",
      e.website,
      e.instagram,
      e.facebook,
      e.categoria,
      idioma,
      classificarStatusSite(e),
      abreWhatsapp(e.telefone, busca.pais),
    ] as const,
  }));

  // Em lote: um `execute` por empresa seriam 50 viagens ao Turso.
  await banco.batch(statements.map((s) => ({ sql: s.sql, args: [...s.args] })), "write");
}
