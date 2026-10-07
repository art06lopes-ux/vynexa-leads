import type { Client, InStatement, InValue } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Empresa } from "@/db/tipos";
import type { LugarEncontrado } from "@/integrations/leads/tipos";
import { idiomaProvavel } from "@/lib/geo/mundo";
import { normalizarLocalidade } from "@/lib/geo/localidade";
import { classificarStatusSite } from "@/lib/leads/classificacao";
import { abreWhatsapp } from "@/lib/leads/whatsapp";
import { acharDuplicata, deduplicarLote, type ChavesEmpresa } from "@/services/duplicatas";
import { eventoSql } from "@/services/eventos";
import { chaveEndereco, chaveNome, dominioProprio, normalizarEmail, telefoneE164 } from "@/services/normalizacao";
import { calcularScore } from "@/services/score";

/**
 * Registro de empresas vindas de qualquer fonte.
 *
 * É o funil por onde passa tudo — Google Places, OSM, CSV, cadastro
 * manual: (1) calcula as chaves de dedup, (2) tira as repetidas dentro
 * do próprio lote, (3) procura no banco quem já existe por place_id,
 * telefone, domínio e nome+endereço, (4) COMPLETA o registro existente
 * com o que a fonte nova traz a mais, ou cria um novo, (5) confere a
 * lista de supressão e (6) calcula o score.
 *
 * Nada é sobrescrito com nulo, e contato existente nunca é trocado por
 * outro: só se preenche o que estava vazio. A exceção é nota e
 * quantidade de avaliações, que envelhecem — a leitura mais nova vale.
 */

/** Teto de parâmetros por statement no D1. */
const MAX_PARAMS = 90;

type Preparado = ChavesEmpresa & {
  lugar: LugarEncontrado;
  emailNorm: string | null;
};

type Conhecido = ChavesEmpresa & { id: string; nao_contatar: number };

export type ResumoRegistro = {
  recebidos: number;
  novos: number;
  completados: number;
  repetidosNoLote: number;
  suprimidos: number;
  /** Todas as empresas que a fonte trouxe (novas + já conhecidas), na ordem. */
  empresaIds: string[];
  novosIds: string[];
};

function preparar(l: LugarEncontrado): Preparado {
  const cidade = normalizarLocalidade(l.cidade) ?? l.cidade;
  return {
    lugar: { ...l, cidade, estado: normalizarLocalidade(l.estado) ?? l.estado },
    place_id: l.fonte === "google_places" ? l.externoId : null,
    osm_id: l.fonte === "osm" ? l.externoId : null,
    cnpj: l.fonte === "receita" ? l.externoId : null,
    telefone_e164: telefoneE164(l.telefone, l.pais),
    dominio: dominioProprio(l.website),
    nome_chave: chaveNome(l.nome),
    endereco_chave: chaveEndereco(l.endereco),
    cidade,
    emailNorm: normalizarEmail(l.email),
  };
}

async function emLotes<T>(valores: T[], consulta: (lote: T[]) => Promise<void>, tamanho = MAX_PARAMS): Promise<void> {
  for (let i = 0; i < valores.length; i += tamanho) await consulta(valores.slice(i, i + tamanho));
}

async function buscarConhecidos(banco: Client, itens: Preparado[]): Promise<Conhecido[]> {
  const encontrados = new Map<string, Conhecido>();
  const colunas = `id, place_id, osm_id, cnpj, telefone_e164, dominio, nome_chave, endereco_chave, cidade, nao_contatar`;

  const porColuna = async (coluna: keyof ChavesEmpresa) => {
    const valores = [...new Set(itens.map((i) => i[coluna]).filter((v): v is string => Boolean(v)))];
    await emLotes(valores, async (lote) => {
      const { rows } = await banco.execute({
        sql: `SELECT ${colunas} FROM empresas WHERE ${coluna} IN (${lote.map(() => "?").join(",")})`,
        args: lote,
      });
      for (const r of rows) encontrados.set(String(r.id), { ...(r as unknown as Conhecido) });
    });
  };

  await porColuna("place_id");
  await porColuna("osm_id");
  await porColuna("cnpj");
  await porColuna("telefone_e164");
  await porColuna("dominio");
  await porColuna("nome_chave");
  return [...encontrados.values()];
}

async function carregarSupressao(banco: Client, itens: Preparado[]): Promise<Set<string>> {
  const chaves: Array<[string, string]> = [];
  for (const i of itens) {
    if (i.emailNorm) chaves.push(["email", i.emailNorm]);
    if (i.telefone_e164) chaves.push(["telefone", i.telefone_e164]);
    if (i.dominio) chaves.push(["dominio", i.dominio]);
    if (i.place_id) chaves.push(["place_id", i.place_id]);
  }
  const suprimidos = new Set<string>();
  const valores = [...new Set(chaves.map(([, v]) => v))];
  await emLotes(valores, async (lote) => {
    const { rows } = await banco.execute({
      sql: `SELECT tipo, valor FROM supressao WHERE valor IN (${lote.map(() => "?").join(",")})`,
      args: lote,
    });
    for (const r of rows) suprimidos.add(`${r.tipo}:${r.valor}`);
  });
  return suprimidos;
}

function estaSuprimido(i: Preparado, s: Set<string>): boolean {
  return (
    (i.emailNorm !== null && s.has(`email:${i.emailNorm}`)) ||
    (i.telefone_e164 !== null && s.has(`telefone:${i.telefone_e164}`)) ||
    (i.dominio !== null && s.has(`dominio:${i.dominio}`)) ||
    (i.place_id !== null && s.has(`place_id:${i.place_id}`))
  );
}

export async function registrarLugares(
  banco: Client,
  lugares: LugarEncontrado[],
  ctx: { buscaId: string | null },
): Promise<ResumoRegistro> {
  const preparados = lugares.map(preparar);
  const { unicos, repetidos } = deduplicarLote(preparados);
  const conhecidos = await buscarConhecidos(banco, unicos);
  const supressao = await carregarSupressao(banco, unicos);

  const statements: InStatement[] = [];
  const empresaIds: string[] = [];
  const novosIds: string[] = [];
  let completados = 0;
  let suprimidos = 0;
  const instante = agora();

  for (const item of unicos) {
    const l = item.lugar;
    const suprimir = estaSuprimido(item, supressao);
    if (suprimir) suprimidos += 1;

    const statusSite = classificarStatusSite({
      website: l.website,
      telefone: l.telefone,
      email: item.emailNorm,
      instagram: l.instagram,
      facebook: l.facebook,
    });
    const whatsapp = abreWhatsapp(l.telefone, l.pais);

    const dup = acharDuplicata(item, conhecidos);
    if (dup) {
      completados += 1;
      empresaIds.push(dup.registro.id);
      statements.push(sqlCompletar(dup.registro.id, item, statusSite, whatsapp, suprimir, instante));
      if (ctx.buscaId) statements.push(sqlResultado(ctx.buscaId, dup.registro.id, false));
      continue;
    }

    const empresaId = novoId();
    const leadId = novoId();
    empresaIds.push(empresaId);
    novosIds.push(empresaId);
    // O próximo item do lote também precisa enxergar este como conhecido.
    conhecidos.push({ ...item, id: empresaId, nao_contatar: suprimir ? 1 : 0 });

    statements.push(sqlInserir(empresaId, item, statusSite, whatsapp, suprimir, ctx.buscaId, instante));

    const score = calcularScore({
      status_site: statusSite,
      site_qualidade: null,
      whatsapp,
      email: item.emailNorm,
      instagram: l.instagram,
      avaliacao_nota: l.avaliacaoNota,
      avaliacao_qtd: l.avaliacaoQtd,
      status_negocio: l.statusNegocio,
      fonte: l.fonte,
      categoria: l.categoria,
      categoria_rotulo: l.categoriaRotulo,
      telefone: l.telefone,
    });
    statements.push({
      sql: `INSERT INTO leads (id, empresa_id, score_oportunidade, score_motivos, score_calculado_em, prioridade, etapa, etapa_em, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, 'novo', ?, ?, ?)`,
      args: [leadId, empresaId, score.score, JSON.stringify(score.motivos), instante, score.prioridade, instante, instante, instante],
    });
    const origem = { google_places: "Google Maps", osm: "OpenStreetMap", receita: "Receita Federal", csv: "importação CSV", manual: "cadastro manual" }[l.fonte];
    statements.push(eventoSql(leadId, "lead_encontrado", `Lead encontrado via ${origem}`, { fonte: l.fonte, buscaId: ctx.buscaId }));
    if (ctx.buscaId) statements.push(sqlResultado(ctx.buscaId, empresaId, true));
  }

  // Lotes de 40 statements: cada um vai numa ida só ao banco.
  for (let i = 0; i < statements.length; i += 40) {
    await banco.batch(statements.slice(i, i + 40), "write");
  }

  // As completadas mudaram (nota, site, contato): o score acompanha.
  const completadosIds = empresaIds.filter((id) => !novosIds.includes(id));
  if (completadosIds.length > 0) await recalcularScores(banco, completadosIds);

  return {
    recebidos: lugares.length,
    novos: novosIds.length,
    completados,
    repetidosNoLote: repetidos,
    suprimidos,
    empresaIds,
    novosIds,
  };
}

function sqlResultado(buscaId: string, empresaId: string, nova: boolean): InStatement {
  return {
    sql: `INSERT OR IGNORE INTO busca_resultados (busca_id, empresa_id, nova) VALUES (?, ?, ?)`,
    args: [buscaId, empresaId, nova ? 1 : 0],
  };
}

function sqlInserir(
  id: string,
  i: Preparado,
  statusSite: string,
  whatsapp: number,
  suprimir: boolean,
  buscaId: string | null,
  instante: string,
): InStatement {
  const l = i.lugar;
  const args: InValue[] = [
    id, buscaId, l.fonte, l.fonteUrl, i.place_id, i.osm_id, i.cnpj, l.nome, i.nome_chave,
    l.pais, l.estado, l.cidade, l.bairro, l.cep, l.endereco, i.endereco_chave, l.latitude, l.longitude,
    l.telefone, i.telefone_e164, l.telefone ? l.fonte : null, whatsapp,
    i.emailNorm, i.emailNorm ? l.fonte : null, l.website, i.dominio, l.instagram, l.facebook,
    l.categoria, l.categoriaRotulo, l.avaliacaoNota, l.avaliacaoQtd, l.statusNegocio,
    idiomaProvavel(l.pais), statusSite, suprimir ? 1 : 0, suprimir ? "Na lista de supressão" : null,
    suprimir ? instante : null, instante, instante,
  ];
  return {
    // OR IGNORE: duas execuções simultâneas com o mesmo place_id — o
    // UNIQUE decide, e a segunda simplesmente não entra.
    sql: `INSERT OR IGNORE INTO empresas (
            id, busca_id, fonte, fonte_url, place_id, osm_id, cnpj, nome, nome_chave,
            pais, estado, cidade, bairro, cep, endereco, endereco_chave, latitude, longitude,
            telefone, telefone_e164, telefone_origem, whatsapp,
            email, email_origem, website, dominio, instagram, facebook,
            categoria, categoria_rotulo, avaliacao_nota, avaliacao_qtd, status_negocio,
            idioma_abordagem, status_site, nao_contatar, nao_contatar_motivo,
            nao_contatar_em, criado_em, atualizado_em
          ) VALUES (${args.map(() => "?").join(",")})`,
    args,
  };
}

function sqlCompletar(id: string, i: Preparado, statusSite: string, whatsapp: number, suprimir: boolean, instante: string): InStatement {
  const l = i.lugar;
  return {
    sql: `UPDATE empresas SET
            place_id        = COALESCE(place_id, ?),
            osm_id          = COALESCE(osm_id, ?),
            fonte_url       = COALESCE(fonte_url, ?),
            nome_chave      = COALESCE(nome_chave, ?),
            bairro          = COALESCE(bairro, ?),
            cep             = COALESCE(cep, ?),
            endereco        = COALESCE(endereco, ?),
            endereco_chave  = COALESCE(endereco_chave, ?),
            latitude        = COALESCE(latitude, ?),
            longitude       = COALESCE(longitude, ?),
            telefone_origem = CASE WHEN telefone IS NULL AND ? IS NOT NULL THEN ? ELSE telefone_origem END,
            telefone        = COALESCE(telefone, ?),
            telefone_e164   = COALESCE(telefone_e164, ?),
            -- No UPDATE do SQLite toda expressão enxerga a linha ANTIGA:
            -- só recalcula o WhatsApp quando o telefone era vazio e vai
            -- ser preenchido agora.
            whatsapp        = CASE WHEN telefone IS NULL THEN ? ELSE whatsapp END,
            email_origem    = CASE WHEN email IS NULL AND ? IS NOT NULL THEN ? ELSE email_origem END,
            email           = COALESCE(email, ?),
            website         = COALESCE(website, ?),
            dominio         = COALESCE(dominio, ?),
            instagram       = COALESCE(instagram, ?),
            facebook        = COALESCE(facebook, ?),
            categoria_rotulo = COALESCE(categoria_rotulo, ?),
            avaliacao_nota  = COALESCE(?, avaliacao_nota),
            avaliacao_qtd   = COALESCE(?, avaliacao_qtd),
            status_negocio  = COALESCE(?, status_negocio),
            status_site     = CASE WHEN status_site = 'sem_dado' OR (status_site <> 'tem_site' AND ? = 'tem_site') THEN ? ELSE status_site END,
            nao_contatar    = CASE WHEN ? = 1 THEN 1 ELSE nao_contatar END,
            atualizado_em   = ?
          WHERE id = ?`,
    args: [
      i.place_id, i.osm_id, l.fonteUrl, i.nome_chave, l.bairro, l.cep, l.endereco, i.endereco_chave, l.latitude, l.longitude,
      l.telefone, l.fonte, l.telefone, i.telefone_e164, whatsapp,
      i.emailNorm, l.fonte, i.emailNorm, l.website, i.dominio, l.instagram, l.facebook, l.categoriaRotulo,
      l.avaliacaoNota, l.avaliacaoQtd, l.statusNegocio, statusSite, statusSite, suprimir ? 1 : 0, instante, id,
    ],
  };
}

/** Recalcula o score (regras de `services/score.ts`) das empresas dadas. */
export async function recalcularScores(banco: Client, empresaIds: string[]): Promise<number> {
  let atualizados = 0;
  await emLotes(empresaIds, async (lote) => {
    const { rows } = await banco.execute({
      sql: `SELECT * FROM empresas WHERE id IN (${lote.map(() => "?").join(",")})`,
      args: lote,
    });
    const instante = agora();
    const statements: InStatement[] = rows.map((r) => {
      const e = r as unknown as Empresa;
      const s = calcularScore(e);
      return {
        sql: `UPDATE leads SET score_oportunidade = ?, score_motivos = ?, score_calculado_em = ?, prioridade = ?, atualizado_em = ?
              WHERE empresa_id = ?`,
        args: [s.score, JSON.stringify(s.motivos), instante, s.prioridade, instante, e.id],
      };
    });
    if (statements.length > 0) await banco.batch(statements, "write");
    atualizados += statements.length;
  });
  return atualizados;
}
