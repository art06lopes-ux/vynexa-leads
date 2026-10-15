import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import { verificarSite } from "@/integrations/site/verificador";
import { ehAlimentacao } from "@/lib/leads/classificacao";
import { eventoSql } from "@/services/eventos";
import { avaliarSinais, ROTULO_PRESENCA } from "@/services/qualidade-site";
import { recalcularScores } from "@/services/registro";

/**
 * Visita os sites ainda não avaliados e grava a qualidade medida.
 * Um site por vez, para não martelar ninguém; se reenfileira enquanto
 * houver site na fila.
 */

export type PayloadAvaliarSite = { limite: number; empresaIds?: string[] };

const ORCAMENTO_MS = 3 * 60 * 1000;

export async function processarAvaliacaoSites(banco: Client, payload: PayloadAvaliarSite): Promise<string> {
  const inicio = Date.now();
  const limite = Math.min(Math.max(payload.limite, 1), 40);

  const { rows } = payload.empresaIds?.length
    ? await banco.execute({
        sql: `SELECT e.id, e.website, e.categoria, e.categoria_rotulo, l.id AS lead_id FROM empresas e LEFT JOIN leads l ON l.empresa_id = e.id
              WHERE e.id IN (${payload.empresaIds.slice(0, 90).map(() => "?").join(",")}) AND e.website IS NOT NULL AND e.status_site = 'tem_site'`,
        args: payload.empresaIds.slice(0, 90),
      })
    : await banco.execute({
        sql: `SELECT e.id, e.website, e.categoria, e.categoria_rotulo, l.id AS lead_id FROM empresas e LEFT JOIN leads l ON l.empresa_id = e.id
              WHERE e.status_site = 'tem_site' AND e.website IS NOT NULL AND e.site_avaliado_em IS NULL
              ORDER BY e.criado_em DESC LIMIT ?`,
        args: [limite],
      });

  const avaliados: string[] = [];
  for (const r of rows) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    const sinais = await verificarSite(String(r.website)).catch(() => null);
    const instante = agora();
    if (!sinais) {
      await banco.execute({ sql: `UPDATE empresas SET site_avaliado_em = ? WHERE id = ?`, args: [instante, String(r.id)] });
      continue;
    }
    // Endereço que só leva ao Instagram (qualquer ramo) ou a um cardápio de
    // plataforma (só alimentação): não é site próprio — vira "sem site".
    const terceiro =
      sinais.semSiteProprio === "rede_social" ||
      (sinais.semSiteProprio === "cardapio" && ehAlimentacao(`${r.categoria ?? ""} ${r.categoria_rotulo ?? ""}`));
    if (terceiro) {
      const statements: InStatement[] = [
        {
          sql: `UPDATE empresas SET status_site = 'rede_social', dominio = NULL, site_qualidade = NULL, site_sinais = ?, site_avaliado_em = ?, atualizado_em = ? WHERE id = ?`,
          args: [JSON.stringify({ sinais }), instante, instante, String(r.id)],
        },
      ];
      if (r.lead_id) {
        const oque = sinais.semSiteProprio === "cardapio" ? "cardápio de plataforma de pedidos" : "rede social";
        statements.push(eventoSql(String(r.lead_id), "site_avaliado", `O endereço do site leva só a um ${oque} — sem site próprio`));
      }
      await banco.batch(statements, "write");
      avaliados.push(String(r.id));
      continue;
    }
    const av = avaliarSinais(sinais);
    const statements: InStatement[] = [
      {
        sql: `UPDATE empresas SET site_qualidade = ?, site_sinais = ?, site_tempo_ms = ?, site_avaliado_em = ?, atualizado_em = ? WHERE id = ?`,
        args: [av.qualidade, JSON.stringify({ ...av, sinais }), sinais.tempoMs, instante, instante, String(r.id)],
      },
    ];
    if (r.lead_id) {
      statements.push(eventoSql(String(r.lead_id), "site_avaliado", `Site avaliado: ${ROTULO_PRESENCA[av.qualidade]} (${av.pontos}/100)`));
    }
    await banco.batch(statements, "write");
    avaliados.push(String(r.id));
  }

  if (avaliados.length > 0) await recalcularScores(banco, avaliados);

  const { rows: resto } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas WHERE status_site = 'tem_site' AND website IS NOT NULL AND site_avaliado_em IS NULL`,
  );
  const faltam = Number(resto[0]?.n ?? 0);
  if (!payload.empresaIds && faltam > 0 && rows.length > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'avaliar_site', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ limite })],
    });
  }
  return `${avaliados.length} site(s) avaliado(s), ${faltam} na fila`;
}
