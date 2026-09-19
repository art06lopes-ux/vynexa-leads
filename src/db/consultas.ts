import "server-only";

import type { InValue } from "@libsql/client";

import { agora, getBanco, novoId, plano, planos } from "@/db/cliente";
import type { Busca, Contadores, Empresa, PayloadBusca, StatusLead } from "@/db/tipos";

/**
 * Consultas do app.
 *
 * SQL cru com parâmetros posicionais, sem ORM: o schema é pequeno e
 * estável, e uma camada a mais não pagaria o próprio peso. Nenhum valor
 * é interpolado na string — os filtros dinâmicos montam a cláusula, e os
 * valores vão sempre por `args`.
 */

// ---------------------------------------------------------------------
// Criar busca
// ---------------------------------------------------------------------

export type NovaBusca = {
  segmento: string;
  pais: string;
  estado: string | null;
  cidade: string | null;
  alvo: number;
};

/**
 * Cria a busca e o job na mesma transação.
 *
 * Junto e não separado: uma busca sem job ficaria "pendente" para sempre
 * na tela, e um job sem busca falharia no worker. Ou nascem os dois, ou
 * nenhum.
 */
export async function criarBuscaComJob(entrada: NovaBusca): Promise<string> {
  const banco = getBanco();
  const buscaId = novoId();
  const payload: PayloadBusca = { buscaId, alvo: entrada.alvo };

  const tx = await banco.transaction("write");
  try {
    await tx.execute({
      sql: `INSERT INTO buscas (id, segmento, pais, estado, cidade, status)
            VALUES (?, ?, ?, ?, ?, 'pendente')`,
      args: [buscaId, entrada.segmento, entrada.pais, entrada.estado, entrada.cidade],
    });

    await tx.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'busca', ?, 'pendente')`,
      args: [novoId(), JSON.stringify(payload)],
    });

    await tx.commit();
  } catch (erro) {
    await tx.rollback();
    throw erro;
  }

  return buscaId;
}

export async function obterBusca(id: string): Promise<Busca | null> {
  const { rows } = await getBanco().execute({
    sql: `SELECT id, segmento, pais, estado, cidade, rotulo_resolvido, raio_final_km,
                 expansoes, status, quantidade_encontrada, quantidade_nova, erro,
                 criado_em, concluido_em
          FROM buscas WHERE id = ?`,
    args: [id],
  });
  return rows[0] ? plano<Busca>(rows[0]) : null;
}

export async function listarBuscasRecentes(limite = 8, pagina = 1): Promise<Busca[]> {
  const { rows } = await getBanco().execute({
    sql: `SELECT id, segmento, pais, estado, cidade, rotulo_resolvido, raio_final_km,
                 expansoes, status, quantidade_encontrada, quantidade_nova, quantidade_receita,
                 erro, criado_em, concluido_em
          FROM buscas ORDER BY criado_em DESC LIMIT ? OFFSET ?`,
    args: [limite, (pagina - 1) * limite],
  });
  return planos<Busca>(rows);
}

/** Total de caçadas já executadas — usado pela paginação do Histórico. */
export async function contarBuscas(): Promise<number> {
  const { rows } = await getBanco().execute(`SELECT COUNT(*) AS n FROM buscas`);
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------
// Filtros e listagem
// ---------------------------------------------------------------------

export type Filtros = {
  segmento?: string;
  pais?: string;
  estado?: string;
  cidade?: string;
  /** true = só quem tem site próprio; false = só quem não tem. */
  temSite?: boolean;
  temEmail?: boolean;
  temTelefone?: boolean;
  /** Score mínimo da análise de IA. 70 é o corte de "oportunidade alta". */
  scoreMin?: number;
  canal?: "whatsapp" | "email";
  /** De onde a linha veio: mapa ou cadastro da Receita. */
  fonte?: "osm" | "receita";
  /** Etapa do funil. */
  etapa?: StatusLead;
  busca?: string;
};

/** Monta o WHERE e os argumentos a partir dos filtros preenchidos. */
function montarWhere(f: Filtros): { clausula: string; args: InValue[] } {
  const partes: string[] = [];
  const args: InValue[] = [];

  if (f.segmento) {
    partes.push("e.categoria = ?");
    args.push(f.segmento);
  }
  if (f.pais) {
    partes.push("e.pais = ?");
    args.push(f.pais);
  }
  if (f.estado) {
    partes.push("e.estado = ?");
    args.push(f.estado);
  }
  if (f.cidade) {
    partes.push("e.cidade = ?");
    args.push(f.cidade);
  }

  // "Tem site" é `status_site = 'tem_site'` e não `website IS NOT NULL`:
  // um perfil de Instagram preenche o campo website sem ser um site.
  if (f.temSite === true) partes.push("e.status_site = 'tem_site'");
  if (f.temSite === false) partes.push("e.status_site IN ('sem_site','rede_social','sem_dado')");

  if (f.temEmail === true) partes.push("e.email IS NOT NULL AND e.email <> ''");
  if (f.temEmail === false) partes.push("(e.email IS NULL OR e.email = '')");

  if (f.temTelefone === true) partes.push("e.telefone IS NOT NULL AND e.telefone <> ''");
  if (f.temTelefone === false) partes.push("(e.telefone IS NULL OR e.telefone = '')");

  if (f.scoreMin !== undefined) {
    partes.push("l.score_oportunidade >= ?");
    args.push(f.scoreMin);
  }
  // Canal pelos fatos, não pela IA: "WhatsApp" é celular discável,
  // "E-mail" é ter e-mail. Antes vinha de `canal_recomendado`, que só
  // existe depois da análise — empresa recém-caçada nunca aparecia.
  if (f.canal === "whatsapp") partes.push("e.whatsapp = 1");
  if (f.canal === "email") partes.push("e.email IS NOT NULL AND e.email <> ''");
  if (f.fonte) {
    partes.push("e.fonte = ?");
    args.push(f.fonte);
  }
  if (f.etapa) {
    partes.push("l.status = ?");
    args.push(f.etapa);
  }

  if (f.busca) {
    partes.push("(e.nome LIKE ? OR e.endereco LIKE ?)");
    const curinga = `%${f.busca}%`;
    args.push(curinga, curinga);
  }

  return {
    clausula: partes.length > 0 ? `WHERE ${partes.join(" AND ")}` : "",
    args,
  };
}

export type EmpresaListada = Empresa & {
  score_oportunidade: number | null;
  motivo_problema: string | null;
  mensagem_gerada: string | null;
  canal_recomendado: "whatsapp" | "email" | null;
  status_lead: StatusLead | null;
};

export async function listarEmpresas(
  filtros: Filtros,
  pagina = 1,
  porPagina = 50,
): Promise<{ itens: EmpresaListada[]; total: number }> {
  const banco = getBanco();
  const { clausula, args } = montarWhere(filtros);

  const [{ rows: contagem }, { rows }] = await Promise.all([
    // O LEFT JOIN aparece também na contagem porque os filtros de score
    // e de canal referenciam colunas de `leads`.
    banco.execute({
      sql: `SELECT COUNT(*) AS n FROM empresas e
            LEFT JOIN leads l ON l.empresa_id = e.id ${clausula}`,
      args,
    }),
    banco.execute({
      // LEFT JOIN e não INNER: na Etapa 1 nenhuma empresa tem lead ainda,
      // e um INNER JOIN devolveria uma lista vazia.
      sql: `SELECT e.*, l.score_oportunidade, l.motivo_problema, l.mensagem_gerada,
                   l.canal_recomendado, l.status AS status_lead
            FROM empresas e
            LEFT JOIN leads l ON l.empresa_id = e.id
            ${clausula}
            ORDER BY l.score_oportunidade DESC NULLS LAST, e.criado_em DESC
            LIMIT ? OFFSET ?`,
      args: [...args, porPagina, (pagina - 1) * porPagina],
    }),
  ]);

  return {
    itens: planos<EmpresaListada>(rows),
    total: Number(contagem[0]?.n ?? 0),
  };
}

/** Todas as linhas que casam com o filtro, sem paginação. Usado no CSV. */
export async function listarEmpresasParaExportar(filtros: Filtros): Promise<EmpresaListada[]> {
  const { clausula, args } = montarWhere(filtros);
  const { rows } = await getBanco().execute({
    sql: `SELECT e.*, l.score_oportunidade, l.motivo_problema, l.mensagem_gerada,
                 l.canal_recomendado, l.status AS status_lead
          FROM empresas e
          LEFT JOIN leads l ON l.empresa_id = e.id
          ${clausula}
          ORDER BY e.criado_em DESC`,
    args,
  });
  return planos<EmpresaListada>(rows);
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

/**
 * Contadores do painel, em uma consulta só.
 *
 * Cinco `COUNT(*)` separados seriam cinco viagens ao Turso; agregações
 * condicionais resolvem numa varredura. `comWhatsapp` lê a coluna
 * `whatsapp`, calculada na gravação pela regra de `abreWhatsapp`.
 */
export async function obterContadores(): Promise<Contadores> {
  const banco = getBanco();

  const [{ rows }, { rows: altas }] = await Promise.all([
    banco.execute(`
      SELECT
        COUNT(*)                                                          AS total,
        SUM(CASE WHEN status_site IN ('sem_site','rede_social') THEN 1 ELSE 0 END) AS sem_site,
        SUM(CASE WHEN email IS NOT NULL AND email <> ''         THEN 1 ELSE 0 END) AS com_email,
        SUM(CASE WHEN whatsapp = 1 THEN 1 ELSE 0 END)                      AS com_whatsapp
      FROM empresas
    `),
    banco.execute(`SELECT COUNT(*) AS n FROM leads WHERE score_oportunidade >= 70`),
  ]);

  const linha = rows[0];
  const comWhatsapp = Number(linha?.com_whatsapp ?? 0);
  return {
    total: Number(linha?.total ?? 0),
    semSite: Number(linha?.sem_site ?? 0),
    comEmail: Number(linha?.com_email ?? 0),
    comWhatsapp,
    oportunidadeAlta: Number(altas[0]?.n ?? 0),
  };
}

export type PontoSerie = { dia: string; valor: number };

/**
 * Empresas adicionadas por dia — período atual e o imediatamente
 * anterior, alinhados dia a dia para a linha de comparação do gráfico.
 *
 * Dias sem resultado entram como zero. Sem isso a linha ligaria segunda
 * direto em sexta como se nada tivesse acontecido no meio.
 */
export async function obterSerieLeads(
  dias = 14,
): Promise<{ atual: PontoSerie[]; anterior: PontoSerie[] }> {
  const { rows } = await getBanco().execute({
    sql: `SELECT date(criado_em) AS dia, COUNT(*) AS total
          FROM empresas
          WHERE criado_em >= date('now', ?)
          GROUP BY dia`,
    args: [`-${dias * 2 - 1} days`],
  });

  const porDia = new Map(rows.map((r) => [String(r.dia), Number(r.total)]));
  const janela = (deslocamento: number): PontoSerie[] =>
    Array.from({ length: dias }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - deslocamento - (dias - 1 - i));
      const chave = d.toISOString().slice(0, 10);
      return { dia: chave, valor: porDia.get(chave) ?? 0 };
    });

  return { atual: janela(0), anterior: janela(dias) };
}

/** Quantas empresas ainda não passaram pela análise de IA. */
export async function contarSemAnalise(): Promise<number> {
  const { rows } = await getBanco().execute(
    `SELECT COUNT(*) AS n FROM empresas e
     LEFT JOIN leads l ON l.empresa_id = e.id
     WHERE l.analisado_em IS NULL`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** Valores distintos para popular os seletores de filtro. */
export async function obterOpcoesDeFiltro(): Promise<{
  segmentos: string[];
  paises: string[];
  estados: string[];
  cidades: string[];
}> {
  const banco = getBanco();
  const [seg, pais, est, cid] = await Promise.all([
    banco.execute(`SELECT DISTINCT categoria AS v FROM empresas ORDER BY v`),
    banco.execute(`SELECT DISTINCT pais AS v FROM empresas ORDER BY v`),
    banco.execute(`SELECT DISTINCT estado AS v FROM empresas WHERE estado IS NOT NULL ORDER BY v`),
    banco.execute(`SELECT DISTINCT cidade AS v FROM empresas WHERE cidade IS NOT NULL ORDER BY v`),
  ]);

  const extrair = (r: { rows: unknown[] }) =>
    (r.rows as Array<{ v: string }>).map((linha) => linha.v).filter(Boolean);

  return {
    segmentos: extrair(seg),
    paises: extrair(pais),
    estados: extrair(est),
    cidades: extrair(cid),
  };
}

export { agora };
