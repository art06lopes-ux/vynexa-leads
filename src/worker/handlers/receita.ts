import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Busca } from "@/db/tipos";
import { normalizarLocalidade } from "@/lib/geo/localidade";
import { classificarStatusSite } from "@/lib/leads/classificacao";
import { ehCelularBrasil } from "@/lib/leads/whatsapp";
import { cnaesDoSegmento } from "@/lib/receita/cnaes";
import { caixaMista, chaveDeMunicipio, chaveDeNome } from "@/lib/receita/texto";
import type { Segmento } from "@/lib/osm/segmentos";

/**
 * Complementa uma caçada brasileira com a base da Receita Federal.
 *
 * Roda depois do OpenStreetMap, dentro do mesmo job. Faz duas coisas:
 *
 * 1. Para cada estabelecimento da Receita no município e nos CNAEs do
 *    segmento, procura uma empresa já na carteira com o mesmo nome no
 *    mesmo município. Se acha, preenche o que faltava — telefone, e-mail,
 *    CNPJ — marcando a origem. O OSM sabe onde a empresa fica; a Receita
 *    sabe como falar com ela.
 * 2. O que não casou entra como empresa nova, com `fonte = 'receita'`.
 *
 * Nada é deduzido: cada campo vem de uma linha real do arquivo da
 * Receita, e `cnpj` na carteira é o que permite conferir na fonte.
 */

type Estabelecimento = {
  cnpj: string;
  nome: string;
  cnae: string;
  uf: string;
  municipio: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  email: string | null;
  inicio_atividade: string | null;
};

export type ResultadoReceita = {
  /** Estabelecimentos da Receita lidos nesta fatia. */
  encontradas: number;
  /** Empresas já na carteira que ganharam contato. */
  enriquecidas: number;
  /** Empresas inseridas a partir da Receita. */
  novas: number;
  /** Falso quando a base ainda não foi importada. */
  disponivel: boolean;
  /**
   * Último CNPJ processado quando a fatia acabou antes da base. Nulo
   * quando não há mais nada a ler — ou quando o alvo foi atingido.
   */
  proximoCursor: string | null;
};

/**
 * Linhas por rodada do worker. Uma caçada de "restaurante" no Brasil
 * inteiro passa de 300 mil estabelecimentos; enfiar tudo num job só
 * estouraria os 8 minutos do runner. Em fatias de 20 mil, cada rodada
 * fecha em menos de um minuto e a próxima retoma do cursor.
 */
const FATIA = Number(process.env.RECEITA_FATIA) || 20_000; // env só para testar as fatias com base pequena

/** Linhas lidas da base por página. */
const PAGINA = Math.min(5_000, FATIA);

export async function complementarComReceita(
  banco: Client,
  busca: Busca,
  segmento: Segmento,
  limite: number,
  cursor: string | null = null,
): Promise<ResultadoReceita> {
  const vazio: ResultadoReceita = { encontradas: 0, enriquecidas: 0, novas: 0, disponivel: false, proximoCursor: null };

  const cnaes = cnaesDoSegmento(segmento.slug);
  if (busca.pais !== "BR" || cnaes.length === 0) return vazio;

  // Sem estado é o Brasil inteiro: a base cobre todos os municípios.
  const uf = busca.estado ? busca.estado.toUpperCase() : null;
  const { rows: importada } = await banco.execute({
    sql: `SELECT 1 FROM receita_estabelecimentos ${uf ? "WHERE uf = ?" : ""} LIMIT 1`,
    args: uf ? [uf] : [],
  });
  if (importada.length === 0) return vazio;

  const municipio = busca.cidade ? chaveDeMunicipio(busca.cidade) : null;
  const marcadores = cnaes.map(() => "?").join(",");
  const condicoes = [uf ? "uf = ?" : null, municipio ? "municipio = ?" : null, `cnae IN (${marcadores})`, "cnpj > ?"]
    .filter(Boolean)
    .join(" AND ");

  // Páginas por CNPJ crescente: é o único jeito de retomar de onde parou
  // sem reler o que já foi feito.
  const estabelecimentos: Estabelecimento[] = [];
  let ultimo = cursor ?? "";
  let acabou = false;
  while (estabelecimentos.length < FATIA) {
    const { rows } = await banco.execute({
      sql: `SELECT cnpj, nome, cnae, uf, municipio, logradouro, numero, complemento, bairro, cep,
                   telefone_1, telefone_2, email, inicio_atividade
            FROM receita_estabelecimentos
            WHERE ${condicoes}
            ORDER BY cnpj LIMIT ?`,
      args: [...(uf ? [uf] : []), ...(municipio ? [municipio] : []), ...cnaes, ultimo, PAGINA],
    });
    for (const r of rows) estabelecimentos.push({ ...r } as unknown as Estabelecimento);
    if (rows.length < PAGINA) {
      acabou = true;
      break;
    }
    ultimo = String(rows.at(-1)!.cnpj);
  }

  const resultado: ResultadoReceita = {
    ...vazio,
    disponivel: true,
    encontradas: estabelecimentos.length,
    proximoCursor: acabou || estabelecimentos.length === 0 ? null : estabelecimentos.at(-1)!.cnpj,
  };
  if (estabelecimentos.length === 0) return resultado;

  const conhecidos = await cnpjsConhecidos(banco, estabelecimentos.map((e) => e.cnpj));
  const candidatos = estabelecimentos.filter((e) => !conhecidos.has(e.cnpj));

  // Empresas da carteira no mesmo estado, sem CNPJ ainda, indexadas por
  // nome+município normalizados. É o que permite casar "Barbearia do Zé"
  // (OSM) com "BARBEARIA DO ZE LTDA" (Receita).
  const { rows: carteira } = await banco.execute({
    sql: `SELECT id, nome, estado, cidade, telefone, email FROM empresas
          WHERE pais = 'BR' ${uf ? "AND estado = ?" : ""} AND cnpj IS NULL`,
    args: uf ? [uf] : [],
  });
  const porChave = new Map<string, { id: string; telefone: string | null; email: string | null }>();
  for (const r of carteira) {
    if (!r.cidade || !r.estado) continue;
    const chave = `${chaveDeNome(String(r.nome))}|${String(r.estado).toUpperCase()}|${chaveDeMunicipio(String(r.cidade))}`;
    if (!porChave.has(chave)) {
      porChave.set(chave, {
        id: String(r.id),
        telefone: r.telefone ? String(r.telefone) : null,
        email: r.email ? String(r.email) : null,
      });
    }
  }

  const atualizacoes: Array<{ sql: string; args: (string | null)[] }> = [];
  const novos: Estabelecimento[] = [];

  for (const e of candidatos) {
    const chave = `${chaveDeNome(e.nome)}|${e.uf}|${e.municipio}`;
    const existente = chave.startsWith("|") ? undefined : porChave.get(chave);

    if (existente) {
      porChave.delete(chave);
      const telefone = existente.telefone ? null : melhorTelefone(e);
      const email = existente.email ? null : e.email;
      atualizacoes.push({
        sql: `UPDATE empresas
              SET cnpj = ?,
                  cnae = ?,
                  fundada_em = COALESCE(fundada_em, ?),
                  telefone = COALESCE(telefone, ?),
                  telefone_origem = CASE WHEN telefone IS NULL AND ? IS NOT NULL THEN 'receita' ELSE telefone_origem END,
                  email = COALESCE(email, ?),
                  email_origem = CASE WHEN email IS NULL AND ? IS NOT NULL THEN 'receita' ELSE email_origem END,
                  status_site = CASE WHEN status_site = 'sem_dado' AND (? IS NOT NULL OR ? IS NOT NULL) THEN 'sem_site' ELSE status_site END,
                  atualizado_em = ?
              WHERE id = ? AND cnpj IS NULL`,
        args: [e.cnpj, e.cnae, e.inicio_atividade, telefone, telefone, email, email, telefone, email, agora(), existente.id],
      });
      continue;
    }

    if (novos.length < limite) novos.push(e);
  }

  // Alvo atingido: o que sobrou da base não interessa mais nesta caçada.
  // (Com alvo já cheio pelo OSM, esta fatia ainda serviu para enriquecer.)
  if (novos.length >= limite) resultado.proximoCursor = null;

  for (let i = 0; i < atualizacoes.length; i += 100) {
    await banco.batch(atualizacoes.slice(i, i + 100), "write");
  }
  resultado.enriquecidas = atualizacoes.length;

  if (novos.length > 0) {
    await inserir(banco, busca, segmento, novos);
    resultado.novas = novos.length;
  }

  return resultado;
}

/** Celular antes de fixo: é o que abre conversa no WhatsApp. */
function melhorTelefone(e: Estabelecimento): string | null {
  const opcoes = [e.telefone_1, e.telefone_2].filter((t): t is string => Boolean(t));
  return opcoes.find((t) => ehCelularBrasil(t)) ?? opcoes[0] ?? null;
}

function montarEndereco(e: Estabelecimento): string | null {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const partes = [
    rua ? caixaMista(rua) : null,
    e.complemento ? caixaMista(e.complemento) : null,
    e.bairro ? caixaMista(e.bairro) : null,
    e.cep ? `CEP ${e.cep.slice(0, 5)}-${e.cep.slice(5)}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ").replace(/\s+/g, " ") : null;
}

async function cnpjsConhecidos(banco: Client, cnpjs: string[]): Promise<Set<string>> {
  const conhecidos = new Set<string>();
  for (let i = 0; i < cnpjs.length; i += 200) {
    const lote = cnpjs.slice(i, i + 200);
    const { rows } = await banco.execute({
      sql: `SELECT cnpj FROM empresas WHERE cnpj IN (${lote.map(() => "?").join(",")})`,
      args: lote,
    });
    for (const r of rows) conhecidos.add(String(r.cnpj));
  }
  return conhecidos;
}

async function inserir(banco: Client, busca: Busca, segmento: Segmento, novos: Estabelecimento[]): Promise<void> {
  // A cidade digitada na busca tem acento e caixa certos; a da Receita
  // não tem acento. Quando a busca foi por cidade, os dois são o mesmo
  // lugar e o nome digitado é o melhor. Numa busca por estado inteiro,
  // fica o da Receita normalizado — sem acento, mas é o que a fonte tem.
  const statements = novos.map((e) => {
    const telefone = melhorTelefone(e);
    return {
      sql: `INSERT OR IGNORE INTO empresas (
              id, busca_id, fonte, osm_id, cnpj, nome, pais, estado, cidade, endereco,
              telefone, telefone_origem, email, email_origem,
              categoria, cnae, fundada_em, idioma_abordagem, status_site
            ) VALUES (?,?,'receita',NULL,?,?,'BR',?,?,?,?,?,?,?,?,?,?,'pt-BR',?)`,
      args: [
        novoId(),
        busca.id,
        e.cnpj,
        caixaMista(e.nome),
        e.uf,
        busca.cidade ?? normalizarLocalidade(e.municipio),
        montarEndereco(e),
        telefone,
        telefone ? "receita" : null,
        e.email,
        e.email ? "receita" : null,
        segmento.slug,
        e.cnae,
        e.inicio_atividade,
        classificarStatusSite({ website: null, telefone, email: e.email }),
      ],
    };
  });

  for (let i = 0; i < statements.length; i += 100) {
    await banco.batch(statements.slice(i, i + 100), "write");
  }
}
