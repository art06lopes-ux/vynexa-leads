import { z } from "zod";

import { getBanco, planos } from "@/db/cliente";
import { leadsParaExportar, type LeadListado } from "@/db/leads";
import { ROTULO_FONTE, type FonteEmpresa } from "@/db/tipos";
import { normalizarTelefone } from "@/lib/leads/whatsapp";
import { ErroApi, rota } from "@/server/api";
import { filtrosDaUrl, ListaIds } from "@/server/esquemas";
import { ROTULO_ETAPA } from "@/services/crm";
import { paraCsv, paraJson, paraXlsx, type LinhaExportacao } from "@/services/exportacao";
import { ROTULO_PRESENCA, statusPresenca } from "@/services/qualidade-site";

/**
 * Exportação em CSV, Excel ou JSON — pelos filtros da URL (GET) ou por
 * uma seleção de leads (POST com `leadIds`).
 */

function linha(l: LeadListado): LinhaExportacao {
  return {
    nome: l.nome,
    categoria: l.categoria_rotulo ?? l.categoria,
    endereco: l.endereco,
    cidade: l.cidade,
    pais: l.pais,
    telefone: l.telefone,
    whatsapp: l.whatsapp === 1 ? normalizarTelefone(l.telefone, l.pais) : null,
    email: l.email,
    website: l.website,
    instagram: l.instagram,
    google_maps: l.fonte === "google_places" ? l.fonte_url : null,
    avaliacao_nota: l.avaliacao_nota,
    avaliacao_qtd: l.avaliacao_qtd,
    score: l.score_oportunidade,
    status: ROTULO_PRESENCA[statusPresenca(l.status_site, l.site_qualidade)],
    etapa: ROTULO_ETAPA[l.etapa],
    fonte: ROTULO_FONTE[l.fonte as FonteEmpresa] ?? l.fonte,
    descoberto_em: l.criado_em.slice(0, 10),
  };
}

function responder(linhas: LinhaExportacao[], formato: string): Response {
  const data = new Date().toISOString().slice(0, 10);
  if (formato === "xlsx") {
    return new Response(paraXlsx(linhas) as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leads-vynexa-${data}.xlsx"`,
      },
    });
  }
  if (formato === "json") {
    return new Response(paraJson(linhas), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="leads-vynexa-${data}.json"` },
    });
  }
  // BOM: sem ele o Excel abre o CSV em ANSI e estraga os acentos.
  return new Response(`﻿${paraCsv(linhas)}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-vynexa-${data}.csv"` },
  });
}

function formatoDe(req: Request): string {
  const f = new URL(req.url).searchParams.get("formato") ?? "csv";
  if (!["csv", "xlsx", "json"].includes(f)) throw new ErroApi("Formato inválido. Use csv, xlsx ou json.");
  return f;
}

export const GET = rota(async (req) => {
  const formato = formatoDe(req);
  const leads = await leadsParaExportar(filtrosDaUrl(new URL(req.url).searchParams));
  return responder(leads.map(linha), formato);
});

export const POST = rota(async (req) => {
  const formato = formatoDe(req);
  const { leadIds } = z.object({ leadIds: ListaIds }).parse(await req.json());
  const banco = getBanco();
  const linhas: LeadListado[] = [];
  for (let i = 0; i < leadIds.length; i += 90) {
    const lote = leadIds.slice(i, i + 90);
    const { rows } = await banco.execute({
      sql: `SELECT e.*, l.id AS lead_id, l.score_oportunidade, l.score_motivos, l.prioridade, l.etapa, l.etapa_em, l.analisado_em, l.solucao_sugerida, l.mensagem_gerada
            FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE l.id IN (${lote.map(() => "?").join(",")})
            ORDER BY l.score_oportunidade DESC`,
      args: lote,
    });
    linhas.push(...planos<LeadListado>(rows));
  }
  return responder(linhas.map(linha), formato);
});
