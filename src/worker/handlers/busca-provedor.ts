import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Busca } from "@/db/tipos";
import { ehProvedorBusca, obterProvedor, type ConsultaBusca } from "@/integrations/leads";
import { notificar } from "@/integrations/notificacoes";
import { idiomaProvavel } from "@/lib/geo/mundo";
import { registrarUsoGoogle } from "@/services/cota-google";
import { registrarLugares } from "@/services/registro";

/**
 * Busca por um provedor (Google Places, ou OSM pelo fluxo novo).
 *
 * Roda no worker OU direto na requisição (via `after()` em
 * `/api/buscas`) — quem pegar o job primeiro, pela reserva em
 * `src/worker/fila.ts`. A tela acompanha `buscas.etapa_atual`.
 */

export type PayloadBuscaProvedor = { buscaId: string };

export type FiltrosBusca = {
  site?: "todos" | "sem" | "com" | "ruim";
  comWhatsapp?: boolean;
  comEmail?: boolean;
  avaliacoesMin?: number | null;
  notaMin?: number | null;
  scoreMin?: number | null;
  retangulo?: { sul: number; oeste: number; norte: number; leste: number } | null;
  maxRequisicoes?: number;
  linkMaps?: ConsultaBusca["linkMaps"];
};

export type ResumoBusca = {
  total: number;
  novos: number;
  completados: number;
  semSite: number;
  soRedeSocial: number;
  comWhatsapp: number;
  comEmail: number;
  comInstagram: number;
  score80: number;
  excelentes: number;
  aviso: string | null;
};

async function etapa(banco: Client, buscaId: string, texto: string): Promise<void> {
  await banco.execute({ sql: `UPDATE buscas SET etapa_atual = ? WHERE id = ?`, args: [texto, buscaId] });
}

export async function processarBuscaProvedor(banco: Client, payload: PayloadBuscaProvedor): Promise<string> {
  const { rows } = await banco.execute({ sql: `SELECT * FROM buscas WHERE id = ?`, args: [payload.buscaId] });
  const busca = rows[0] as unknown as Busca | undefined;
  if (!busca) throw new Error(`Busca ${payload.buscaId} não existe.`);
  if (busca.status === "concluida") return "busca já concluída";
  if (!ehProvedorBusca(busca.provedor)) throw new Error(`Provedor desconhecido: ${busca.provedor}`);

  await banco.execute({ sql: `UPDATE buscas SET status = 'em_andamento', erro = NULL WHERE id = ?`, args: [busca.id] });

  const filtros = (busca.filtros ? JSON.parse(busca.filtros) : {}) as FiltrosBusca;
  const consulta: ConsultaBusca = {
    termo: busca.segmento,
    pais: busca.pais && busca.pais !== "ZZ" ? busca.pais : null,
    estado: busca.estado,
    cidade: busca.cidade,
    bairro: busca.bairro,
    cep: busca.cep,
    local: busca.rotulo_resolvido,
    centro: busca.centro_lat !== null && busca.centro_lng !== null ? { lat: busca.centro_lat, lng: busca.centro_lng } : null,
    raioKm: busca.raio_km,
    retangulo: filtros.retangulo ?? null,
    idioma: busca.pais && busca.pais !== "ZZ" ? idiomaProvavel(busca.pais).slice(0, 2) : "pt",
    maxRequisicoes: Math.min(Math.max(filtros.maxRequisicoes ?? 10, 1), 60),
    linkMaps: filtros.linkMaps ?? null,
  };

  const provedor = obterProvedor(busca.provedor);
  let resultado: Awaited<ReturnType<typeof provedor.buscar>>;
  try {
    resultado = await provedor.buscar(consulta, (texto) => etapa(banco, busca.id, texto));
  } finally {
    // Conta o que o Google respondeu mesmo se a busca caiu no meio: a
    // trava mensal precisa ver tudo o que pode virar cobrança.
    if ("requisicoesFeitas" in provedor && typeof provedor.requisicoesFeitas === "number") {
      await registrarUsoGoogle(banco, provedor.requisicoesFeitas);
    }
  }

  await etapa(banco, busca.id, "Analisando presença digital…");
  const registro = await registrarLugares(banco, resultado.lugares, { buscaId: busca.id });

  await etapa(banco, busca.id, "Calculando oportunidade…");
  const resumo = await resumir(banco, busca.id, resultado.aviso);

  const instante = agora();
  await banco.execute({
    sql: `UPDATE buscas SET status = 'concluida', concluido_em = ?, etapa_atual = 'Preparando resultados…',
                            quantidade_encontrada = ?, quantidade_nova = ?, quantidade_duplicada = ?,
                            requisicoes = requisicoes + ?, resumo = ?,
                            bbox_sul = ?, bbox_oeste = ?, bbox_norte = ?, bbox_leste = ?
          WHERE id = ?`,
    args: [
      instante, registro.empresaIds.length, registro.novos, registro.completados + registro.repetidosNoLote, resultado.requisicoes,
      JSON.stringify(resumo), resultado.area?.sul ?? null, resultado.area?.oeste ?? null, resultado.area?.norte ?? null,
      resultado.area?.leste ?? null, busca.id,
    ],
  });

  // Trabalho de fundo: visitar os sites (qualidade + e-mail) e analisar
  // com IA os leads de prioridade alta.
  await enfileirarUmaVez(banco, "avaliar_site", { limite: 20 });
  // E-mails: visita os sites DESTA busca já (a rota roda este job logo
  // depois da busca, na mesma requisição; o que sobrar fica para o worker).
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'enriquecer_email', ?, 'pendente')`,
    args: [novoId(), JSON.stringify({ limite: 60, buscaId: busca.id })],
  });
  if (registro.novosIds.length > 0) {
    const { rows: altas } = await banco.execute({
      sql: `SELECT id FROM leads WHERE prioridade = 'alta' AND analisado_em IS NULL AND empresa_id IN (${registro.novosIds.slice(0, 90).map(() => "?").join(",")})`,
      args: registro.novosIds.slice(0, 90),
    });
    if (altas.length > 0) {
      await banco.execute({
        sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
        args: [novoId(), JSON.stringify({ leadIds: altas.map((r) => String(r.id)), analisar: true, gerarMensagens: false, automatico: true })],
      });
    }
  }

  await notificar(banco, {
    tipo: resumo.score80 > 0 ? "oportunidade" : "busca_concluida",
    titulo: resumo.score80 > 0 ? `${resumo.score80} oportunidades com score acima de 80` : "Busca concluída",
    corpo: `${busca.segmento}${busca.cidade ? ` em ${busca.cidade}` : ""}: ${resumo.total} empresas, ${registro.novos} novas, ${resumo.semSite} sem site.`,
    link: `/buscar?busca=${busca.id}`,
  });

  return `${provedor.rotulo}: ${resumo.total} empresas (${registro.novos} novas, ${registro.completados} já conhecidas) em ${resultado.requisicoes} requisição(ões)`;
}

export async function resumir(banco: Client, buscaId: string, aviso: string | null): Promise<ResumoBusca> {
  const { rows } = await banco.execute({
    sql: `SELECT COUNT(*) AS total,
                 SUM(br.nova) AS novos,
                 SUM(e.status_site = 'sem_site') AS sem_site,
                 SUM(e.status_site = 'rede_social') AS rede,
                 SUM(e.whatsapp = 1) AS whats,
                 SUM(e.email IS NOT NULL) AS email,
                 SUM(e.instagram IS NOT NULL) AS insta,
                 SUM(l.score_oportunidade > 80) AS s80,
                 SUM(l.score_oportunidade >= 90) AS exc
          FROM busca_resultados br
          JOIN empresas e ON e.id = br.empresa_id
          LEFT JOIN leads l ON l.empresa_id = e.id
          WHERE br.busca_id = ?`,
    args: [buscaId],
  });
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  return {
    total: n(r.total),
    novos: n(r.novos),
    completados: n(r.total) - n(r.novos),
    semSite: n(r.sem_site) + n(r.rede),
    soRedeSocial: n(r.rede),
    comWhatsapp: n(r.whats),
    comEmail: n(r.email),
    comInstagram: n(r.insta),
    score80: n(r.s80),
    excelentes: n(r.exc),
    aviso,
  };
}

export async function enfileirarUmaVez(banco: Client, tipo: string, payload: unknown): Promise<void> {
  const { rows } = await banco.execute({
    sql: `SELECT 1 FROM jobs WHERE tipo = ? AND status = 'pendente' LIMIT 1`,
    args: [tipo],
  });
  if (rows.length > 0) return;
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, ?, ?, 'pendente')`,
    args: [novoId(), tipo, JSON.stringify(payload)],
  });
}
