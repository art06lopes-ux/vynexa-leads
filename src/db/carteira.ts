import { agora, getBanco, novoId, planos } from "@/db/cliente";
import type { EstagioCarteira, StatusProjeto, TipoProjeto } from "@/lib/projetos";

export * from "@/lib/projetos";

/**
 * A carteira de relacionamento (quem já respondeu em diante) e os
 * projetos entregues — o lado "depois da venda" do Vynexa.
 */

export type ClienteCarteira = {
  lead_id: string;
  nome: string;
  categoria: string;
  cidade: string | null;
  pais: string;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  etapa: EstagioCarteira;
  etapa_em: string | null;
  receita: number;
  projeto_status: StatusProjeto | null;
  projeto_url: string | null;
};

export async function carteira(): Promise<ClienteCarteira[]> {
  const { rows } = await getBanco().execute(`
    SELECT l.id AS lead_id, e.nome, e.categoria, e.cidade, e.pais, e.telefone, e.email, e.instagram, e.website,
           l.etapa, l.etapa_em,
           COALESCE((SELECT SUM(v.valor_centavos) FROM vendas v WHERE v.lead_id = l.id AND v.status = 'pago'), 0) AS receita,
           (SELECT p.status FROM projetos p WHERE p.lead_id = l.id ORDER BY p.atualizado_em DESC LIMIT 1) AS projeto_status,
           (SELECT p.url FROM projetos p WHERE p.lead_id = l.id ORDER BY p.atualizado_em DESC LIMIT 1) AS projeto_url
    FROM leads l JOIN empresas e ON e.id = l.empresa_id
    WHERE l.etapa IN ('respondeu','negociacao','proposta','fechado')
    ORDER BY CASE l.etapa WHEN 'fechado' THEN 0 WHEN 'proposta' THEN 1 WHEN 'negociacao' THEN 2 ELSE 3 END,
             COALESCE(l.etapa_em, l.atualizado_em) DESC
    LIMIT 500`);
  return planos<ClienteCarteira>(rows).map((c) => ({ ...c, receita: Number(c.receita) }));
}

/** Receita de todas as vendas pagas — com ou sem lead. */
export async function receitaTotal(): Promise<number> {
  const { rows } = await getBanco().execute(`SELECT COALESCE(SUM(valor_centavos),0) AS t FROM vendas WHERE status = 'pago'`);
  return Number(rows[0]?.t ?? 0);
}

// ---------------------------------------------------------------------
// Projetos (sites, landing pages, sistemas)
// ---------------------------------------------------------------------

export type Projeto = {
  id: string;
  lead_id: string | null;
  cliente_nome: string | null;
  nome: string;
  tipo: TipoProjeto;
  status: StatusProjeto;
  url: string | null;
  prazo: string | null;
  valor_centavos: number;
  custo_centavos: number;
  observacoes: string | null;
  publicado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  /** Nome da empresa do lead, quando o projeto está ligado a um. */
  empresa: string | null;
};

export async function listarProjetos(): Promise<Projeto[]> {
  const { rows } = await getBanco().execute(`
    SELECT p.*, e.nome AS empresa
    FROM projetos p
    LEFT JOIN leads l ON l.id = p.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    ORDER BY CASE p.status WHEN 'arquivado' THEN 1 ELSE 0 END, p.atualizado_em DESC`);
  return planos<Projeto>(rows).map((p) => ({ ...p, valor_centavos: Number(p.valor_centavos), custo_centavos: Number(p.custo_centavos) }));
}

export type DadosProjeto = {
  nome: string;
  leadId?: string | null;
  clienteNome?: string | null;
  tipo: TipoProjeto;
  status: StatusProjeto;
  url?: string | null;
  prazo?: string | null;
  valorCentavos?: number;
  custoCentavos?: number;
  observacoes?: string | null;
};

export async function criarProjeto(d: DadosProjeto): Promise<string> {
  const id = novoId();
  const t = agora();
  await getBanco().execute({
    sql: `INSERT INTO projetos (id, lead_id, cliente_nome, nome, tipo, status, url, prazo, valor_centavos, custo_centavos, observacoes, publicado_em, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, d.leadId ?? null, d.clienteNome ?? null, d.nome, d.tipo, d.status, d.url ?? null, d.prazo ?? null,
      d.valorCentavos ?? 0, d.custoCentavos ?? 0, d.observacoes ?? null, d.status === "publicado" ? t : null, t, t,
    ],
  });
  return id;
}

export async function atualizarProjeto(id: string, d: Partial<DadosProjeto>): Promise<boolean> {
  const campos: string[] = [];
  const args: Array<string | number | null> = [];
  const por = (col: string, v: string | number | null | undefined) => {
    if (v === undefined) return;
    campos.push(`${col} = ?`);
    args.push(v);
  };
  por("nome", d.nome);
  por("lead_id", d.leadId);
  por("cliente_nome", d.clienteNome);
  por("tipo", d.tipo);
  por("status", d.status);
  por("url", d.url);
  por("prazo", d.prazo);
  por("valor_centavos", d.valorCentavos);
  por("custo_centavos", d.custoCentavos);
  por("observacoes", d.observacoes);
  if (campos.length === 0) return true;
  const t = agora();
  // Primeira publicação ganha a data; republicar não muda.
  const publicado = d.status === "publicado" ? `, publicado_em = COALESCE(publicado_em, '${t}')` : "";
  const r = await getBanco().execute({ sql: `UPDATE projetos SET ${campos.join(", ")}, atualizado_em = ?${publicado} WHERE id = ?`, args: [...args, t, id] });
  return r.rowsAffected > 0;
}

export async function excluirProjeto(id: string): Promise<boolean> {
  const r = await getBanco().execute({ sql: `DELETE FROM projetos WHERE id = ?`, args: [id] });
  return r.rowsAffected > 0;
}

export async function urlsDeProjetos(): Promise<Set<string>> {
  const { rows } = await getBanco().execute(`SELECT url FROM projetos WHERE url IS NOT NULL`);
  return new Set(rows.map((r) => String(r.url).replace(/\/+$/, "").toLowerCase()));
}
