import "server-only";

import type { InValue } from "@libsql/client";

import { getBanco, plano, planos } from "@/db/cliente";
import { CONDICAO_SITUACAO, type Situacao } from "@/db/para-abordar";
import { ESTADOS_BR } from "@/lib/geo/estados-br";
import { nomePaisPt } from "@/lib/geo/mundo";
import type { Empresa, EtapaLead, Lead, MotivoScore, Prioridade } from "@/db/tipos";

/**
 * Consultas de leads (empresa + lead juntos).
 *
 * SQL cru com parâmetros posicionais: nenhum valor é interpolado — os
 * filtros montam a cláusula e os valores vão por `args`. Ordenação vem
 * de lista fechada.
 */

/**
 * O nicho como o operador o vê: o termo pesquisado, em minúsculas, sem o
 * nome da cidade da própria empresa. Buscas antigas coladas do Maps
 * gravaram "barbearia manacapuru"; aqui isso já aparece como "barbearia".
 */
const NICHO_SQL = `TRIM(REPLACE(LOWER(e.categoria), LOWER(COALESCE(e.cidade, '')), ''))`;

export type FiltrosLeads = {
  q?: string;
  categoria?: string;
  pais?: string;
  cidade?: string;
  /** sem | com | ruim | social | todos */
  site?: string;
  whatsapp?: boolean;
  email?: boolean;
  instagram?: boolean;
  scoreMin?: number;
  avaliacoesMin?: number;
  notaMin?: number;
  etapa?: EtapaLead;
  prioridade?: Prioridade;
  fonte?: string;
  busca?: string;
  campanha?: string;
  naoContatar?: boolean;
  analisado?: boolean;
  /** Estado/região (sigla no Brasil e EUA, nome nos demais). */
  estado?: string;
  /** Não abordados, já abordados, responderam, não contatar. */
  situacao?: Situacao;
  ordem?: "score" | "recentes" | "avaliacoes" | "nome";
};

export type LeadListado = Pick<
  Empresa,
  | "id" | "nome" | "categoria" | "categoria_rotulo" | "cidade" | "estado" | "pais" | "bairro" | "endereco"
  | "telefone" | "whatsapp" | "email" | "website" | "instagram" | "facebook" | "avaliacao_nota" | "avaliacao_qtd"
  | "status_site" | "site_qualidade" | "fonte" | "fonte_url" | "latitude" | "longitude" | "nao_contatar" | "criado_em"
> & {
  lead_id: string;
  score_oportunidade: number | null;
  score_motivos: string | null;
  prioridade: Prioridade | null;
  etapa: EtapaLead;
  etapa_em: string | null;
  analisado_em: string | null;
  solucao_sugerida: string | null;
  mensagem_gerada: string | null;
};

const COLUNAS = `e.id, e.nome, e.categoria, e.categoria_rotulo, e.cidade, e.estado, e.pais, e.bairro, e.endereco,
  e.telefone, e.whatsapp, e.email, e.website, e.instagram, e.facebook, e.avaliacao_nota, e.avaliacao_qtd,
  e.status_site, e.site_qualidade, e.fonte, e.fonte_url, e.latitude, e.longitude, e.nao_contatar, e.criado_em,
  l.id AS lead_id, l.score_oportunidade, l.score_motivos, l.prioridade, l.etapa, l.etapa_em, l.analisado_em,
  l.solucao_sugerida, l.mensagem_gerada`;

const ORDENS: Record<NonNullable<FiltrosLeads["ordem"]>, string> = {
  score: "l.score_oportunidade DESC NULLS LAST, e.avaliacao_qtd DESC NULLS LAST, e.criado_em DESC",
  recentes: "e.criado_em DESC",
  avaliacoes: "e.avaliacao_qtd DESC NULLS LAST, l.score_oportunidade DESC",
  nome: "e.nome COLLATE NOCASE",
};

export function montarWhere(f: FiltrosLeads): { clausula: string; args: InValue[]; juncao: string } {
  const p: string[] = [];
  const a: InValue[] = [];
  let juncao = "";

  if (f.q?.trim()) {
    const termo = `%${f.q.trim()}%`;
    const digitos = f.q.replace(/\D/g, "");
    if (digitos.length >= 6) {
      p.push("(e.nome LIKE ? OR e.telefone_e164 LIKE ? OR e.email LIKE ?)");
      a.push(termo, `%${digitos}%`, termo);
    } else {
      p.push("(e.nome LIKE ? OR e.endereco LIKE ? OR e.email LIKE ? OR e.website LIKE ? OR e.categoria_rotulo LIKE ?)");
      a.push(termo, termo, termo, termo, termo);
    }
  }
  if (f.categoria) {
    // O nicho é o que foi pesquisado ("energia solar"); o rótulo do Google
    // ("Serviços") vale também, para quem filtrar por ele.
    p.push(`(${NICHO_SQL} = LOWER(?) OR LOWER(e.categoria) = LOWER(?) OR e.categoria_rotulo = ?)`);
    a.push(f.categoria, f.categoria, f.categoria);
  }
  if (f.estado) {
    p.push("UPPER(e.estado) = UPPER(?)");
    a.push(f.estado);
  }
  if (f.pais) {
    p.push("e.pais = ?");
    a.push(f.pais);
  }
  if (f.cidade) {
    p.push("e.cidade = ?");
    a.push(f.cidade);
  }
  switch (f.site) {
    case "sem":
      p.push("e.status_site IN ('sem_site','rede_social')");
      break;
    case "social":
      p.push("e.status_site = 'rede_social'");
      break;
    case "com":
      p.push("e.status_site = 'tem_site'");
      break;
    case "ruim":
      p.push("e.status_site = 'tem_site' AND e.site_qualidade IN ('fraco','fora_do_ar')");
      break;
  }
  if (f.whatsapp) p.push("e.whatsapp = 1");
  if (f.email) p.push("e.email IS NOT NULL");
  if (f.instagram) p.push("e.instagram IS NOT NULL");
  if (f.scoreMin !== undefined && f.scoreMin > 0) {
    p.push("l.score_oportunidade >= ?");
    a.push(f.scoreMin);
  }
  if (f.avaliacoesMin !== undefined && f.avaliacoesMin > 0) {
    p.push("e.avaliacao_qtd >= ?");
    a.push(f.avaliacoesMin);
  }
  if (f.notaMin !== undefined && f.notaMin > 0) {
    p.push("e.avaliacao_nota >= ?");
    a.push(f.notaMin);
  }
  if (f.etapa) {
    p.push("l.etapa = ?");
    a.push(f.etapa);
  }
  if (f.prioridade) {
    p.push("l.prioridade = ?");
    a.push(f.prioridade);
  }
  if (f.fonte) {
    p.push("e.fonte = ?");
    a.push(f.fonte);
  }
  if (f.naoContatar === true) p.push("e.nao_contatar = 1");
  if (f.naoContatar === false) p.push("e.nao_contatar = 0");
  if (f.analisado === true) p.push("l.analisado_em IS NOT NULL");
  if (f.analisado === false) p.push("l.analisado_em IS NULL");
  if (f.situacao && CONDICAO_SITUACAO[f.situacao]) p.push(CONDICAO_SITUACAO[f.situacao]);
  if (f.busca) {
    juncao += " JOIN busca_resultados br ON br.empresa_id = e.id AND br.busca_id = ?";
    a.unshift(f.busca);
  }
  if (f.campanha) {
    juncao += " JOIN campanha_leads cl ON cl.lead_id = l.id AND cl.campanha_id = ?";
    // a junção vem antes do WHERE: o argumento entra depois do da busca
    a.splice(f.busca ? 1 : 0, 0, f.campanha);
  }

  return { clausula: p.length ? `WHERE ${p.join(" AND ")}` : "", args: a, juncao };
}

export async function listarLeads(f: FiltrosLeads, pagina = 1, porPagina = 30): Promise<{ itens: LeadListado[]; total: number }> {
  const banco = getBanco();
  const { clausula, args, juncao } = montarWhere(f);
  const ordem = ORDENS[f.ordem ?? "score"];
  const [{ rows: c }, { rows }] = await Promise.all([
    banco.execute({ sql: `SELECT COUNT(*) AS n FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${clausula}`, args }),
    banco.execute({
      sql: `SELECT ${COLUNAS} FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${clausula} ORDER BY ${ordem} LIMIT ? OFFSET ?`,
      args: [...args, porPagina, (Math.max(1, pagina) - 1) * porPagina],
    }),
  ]);
  return { itens: planos<LeadListado>(rows), total: Number(c[0]?.n ?? 0) };
}

export async function contarLeads(f: FiltrosLeads): Promise<number> {
  const { clausula, args, juncao } = montarWhere(f);
  const { rows } = await getBanco().execute({ sql: `SELECT COUNT(*) AS n FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${clausula}`, args });
  return Number(rows[0]?.n ?? 0);
}

/** Só os ids (para "selecionar todos os N que casam com o filtro"). */
export async function idsDosLeads(f: FiltrosLeads, limite = 1000): Promise<string[]> {
  const { clausula, args, juncao } = montarWhere(f);
  const { rows } = await getBanco().execute({
    sql: `SELECT l.id FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${clausula} ORDER BY ${ORDENS[f.ordem ?? "score"]} LIMIT ?`,
    args: [...args, limite],
  });
  return rows.map((r) => String(r.id));
}

export async function leadsParaExportar(f: FiltrosLeads, limite = 20_000): Promise<LeadListado[]> {
  const { clausula, args, juncao } = montarWhere(f);
  const { rows } = await getBanco().execute({
    sql: `SELECT ${COLUNAS} FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${clausula} ORDER BY ${ORDENS[f.ordem ?? "score"]} LIMIT ?`,
    args: [...args, limite],
  });
  return planos<LeadListado>(rows);
}

export async function leadsNoMapa(f: FiltrosLeads, area: { sul: number; oeste: number; norte: number; leste: number } | null, limite = 1500): Promise<LeadListado[]> {
  const { clausula, args, juncao } = montarWhere(f);
  const geo = "e.latitude IS NOT NULL AND e.longitude IS NOT NULL" + (area ? " AND e.latitude BETWEEN ? AND ? AND e.longitude BETWEEN ? AND ?" : "");
  const where = clausula ? `${clausula} AND ${geo}` : `WHERE ${geo}`;
  const { rows } = await getBanco().execute({
    sql: `SELECT ${COLUNAS} FROM empresas e JOIN leads l ON l.empresa_id = e.id ${juncao} ${where} ORDER BY l.score_oportunidade DESC NULLS LAST LIMIT ?`,
    args: [...args, ...(area ? [area.sul, area.norte, area.oeste, area.leste] : []), limite],
  });
  return planos<LeadListado>(rows);
}

export type LeadCompleto = { empresa: Empresa; lead: Lead; motivos: MotivoScore[] };

export async function obterLead(leadId: string): Promise<LeadCompleto | null> {
  const banco = getBanco();
  const { rows } = await banco.execute({ sql: `SELECT * FROM leads WHERE id = ?`, args: [leadId] });
  if (!rows[0]) return null;
  const lead = plano<Lead>(rows[0]);
  const { rows: er } = await banco.execute({ sql: `SELECT * FROM empresas WHERE id = ?`, args: [lead.empresa_id] });
  if (!er[0]) return null;
  let motivos: MotivoScore[] = [];
  try {
    motivos = lead.score_motivos ? (JSON.parse(lead.score_motivos) as MotivoScore[]) : [];
  } catch {
    motivos = [];
  }
  return { empresa: plano<Empresa>(er[0]), lead, motivos };
}

export type EventoLead = { id: string; tipo: string; descricao: string; dados: string | null; criado_em: string };
export type MensagemLead = { id: string; tipo: string; assunto: string | null; corpo: string; idioma: string | null; criado_em: string };
export type EnvioLead = { id: string; campanha_id: string | null; campanha_nome: string | null; passo: number; assunto: string | null; status: string; enviado_em: string | null; aberto_em: string | null; clicado_em: string | null; erro: string | null; agendado_para: string | null };
export type PropostaLead = { id: string; titulo: string; conteudo: string; valor_centavos: number | null; status: string; produto_id: string | null; criado_em: string };
export type VendaLead = { id: string; descricao: string; valor_centavos: number; moeda: string; status: string; criado_em: string; pago_em: string | null };

export async function detalhesDoLead(leadId: string): Promise<{
  eventos: EventoLead[];
  mensagens: MensagemLead[];
  envios: EnvioLead[];
  propostas: PropostaLead[];
  vendas: VendaLead[];
  campanhas: Array<{ id: string; nome: string }>;
}> {
  const banco = getBanco();
  const [ev, msg, env, prop, ven, camp] = await Promise.all([
    banco.execute({ sql: `SELECT id, tipo, descricao, dados, criado_em FROM eventos WHERE lead_id = ? ORDER BY criado_em DESC, rowid DESC LIMIT 200`, args: [leadId] }),
    banco.execute({ sql: `SELECT id, tipo, assunto, corpo, idioma, criado_em FROM mensagens WHERE lead_id = ? ORDER BY criado_em DESC LIMIT 40`, args: [leadId] }),
    banco.execute({
      sql: `SELECT en.id, en.campanha_id, c.nome AS campanha_nome, en.passo, en.assunto, en.status, en.enviado_em, en.aberto_em, en.clicado_em, en.erro, en.agendado_para
            FROM envios en LEFT JOIN campanhas c ON c.id = en.campanha_id WHERE en.lead_id = ? ORDER BY en.criado_em DESC LIMIT 50`,
      args: [leadId],
    }),
    banco.execute({ sql: `SELECT id, titulo, conteudo, valor_centavos, status, produto_id, criado_em FROM propostas WHERE lead_id = ? ORDER BY criado_em DESC`, args: [leadId] }),
    banco.execute({ sql: `SELECT id, descricao, valor_centavos, moeda, status, criado_em, pago_em FROM vendas WHERE lead_id = ? ORDER BY criado_em DESC`, args: [leadId] }),
    banco.execute({ sql: `SELECT c.id, c.nome FROM campanha_leads cl JOIN campanhas c ON c.id = cl.campanha_id WHERE cl.lead_id = ?`, args: [leadId] }),
  ]);
  return {
    eventos: planos<EventoLead>(ev.rows),
    mensagens: planos<MensagemLead>(msg.rows),
    envios: planos<EnvioLead>(env.rows),
    propostas: planos<PropostaLead>(prop.rows),
    vendas: planos<VendaLead>(ven.rows),
    campanhas: planos<{ id: string; nome: string }>(camp.rows),
  };
}

export type OpcaoFiltro = { valor: string; rotulo: string };

/**
 * As opções dos filtros, a partir do que existe na carteira. Em cascata:
 * com um país escolhido, só os estados dele; com um estado, só as
 * cidades dele — a lista nunca oferece combinação que dá zero.
 */
export async function opcoesDeFiltro(sel: { pais?: string; estado?: string } = {}): Promise<{
  paises: OpcaoFiltro[];
  estados: OpcaoFiltro[];
  cidades: string[];
  nichos: string[];
  /** Mesmo que `nichos` (nome antigo, usado pela nova campanha). */
  categorias: string[];
}> {
  const banco = getBanco();
  const ondePais = sel.pais ? "AND pais = ?" : "";
  const argsPais = sel.pais ? [sel.pais] : [];
  const ondeEstado = sel.estado ? "AND UPPER(estado) = UPPER(?)" : "";
  const argsEstado = sel.estado ? [sel.estado] : [];
  const [nic, pais, est, cid] = await Promise.all([
    banco.execute(`SELECT ${NICHO_SQL} AS v, COUNT(*) n FROM empresas e WHERE e.categoria IS NOT NULL AND e.categoria <> '' GROUP BY v HAVING v <> '' ORDER BY n DESC LIMIT 80`),
    banco.execute(`SELECT pais AS v, COUNT(*) n FROM empresas WHERE pais IS NOT NULL AND pais <> 'ZZ' GROUP BY pais ORDER BY n DESC`),
    banco.execute({
      sql: `SELECT UPPER(estado) AS v, MAX(pais) AS pais, COUNT(*) n FROM empresas WHERE estado IS NOT NULL AND estado <> '' ${ondePais} GROUP BY v ORDER BY n DESC LIMIT 100`,
      args: argsPais,
    }),
    banco.execute({
      sql: `SELECT cidade AS v, COUNT(*) n FROM empresas WHERE cidade IS NOT NULL AND cidade <> '' ${ondePais} ${ondeEstado} GROUP BY cidade ORDER BY n DESC LIMIT 300`,
      args: [...argsPais, ...argsEstado],
    }),
  ]);
  const lista = (r: { rows: unknown[] }) => (r.rows as Array<{ v: string }>).map((x) => String(x.v)).filter(Boolean);
  const nichos = lista(nic);
  return {
    paises: lista(pais).map((c) => ({ valor: c, rotulo: nomePaisPt(c) })).sort((a, b) => (a.valor === "BR" ? -1 : b.valor === "BR" ? 1 : a.rotulo.localeCompare(b.rotulo, "pt-BR"))),
    estados: (est.rows as unknown as Array<{ v: string; pais: string }>)
      .map((r) => {
        const uf = String(r.v);
        const nome = String(r.pais) === "BR" ? ESTADOS_BR[uf] : undefined;
        return { valor: uf, rotulo: nome ? `${nome} (${uf})` : uf.charAt(0) + uf.slice(1).toLowerCase() };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    cidades: lista(cid).sort((a, b) => a.localeCompare(b, "pt-BR")),
    nichos,
    categorias: nichos,
  };
}
