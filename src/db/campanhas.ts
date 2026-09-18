import "server-only";

import { agora, getBanco, novoId, plano, planos } from "@/db/cliente";

export type StatusCampanha = "rascunho" | "em_envio" | "concluida" | "pausada";

export type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  status: StatusCampanha;
  total_leads: number;
  enviados: number;
  falhas: number;
  criado_em: string;
};

export type EnvioListado = {
  id: string;
  status: "pendente" | "na_fila" | "enviado" | "erro";
  assunto: string | null;
  corpo: string | null;
  erro: string | null;
  enviado_em: string | null;
  empresa_nome: string;
  email: string | null;
  pais: string;
};

/**
 * Cria a campanha a partir de empresas escolhidas.
 *
 * Só entra quem tem e-mail — sem e-mail não há o que enviar, e um lead
 * mudo na lista só confundiria a contagem. Quem ainda não tem lead (não
 * passou pela análise) ganha um lead vazio: a geração do e-mail funciona
 * sem o diagnóstico, só fica menos específica.
 *
 * Tudo num `batch` atômico: campanha sem envios, ou envios sem campanha,
 * seria lixo no banco. E num batch, não numa transação interativa: cada
 * `execute` dentro da transação é uma ida ao Turso (~0,8 s da Vercel),
 * e com três por lead a criação de uma campanha de 20 empresas passava
 * dos 10 segundos que a Vercel permite — a tela ficava "carregando" e a
 * campanha não nascia. O batch é uma ida só.
 */
export async function criarCampanha(entrada: {
  nome: string;
  descricao?: string | null;
  empresaIds: string[];
}): Promise<{ id: string; incluidas: number; semEmail: number }> {
  const banco = getBanco();

  // 100 é o teto de parâmetros por statement no D1 — uma campanha de mais
  // de 100 empresas precisa de mais de uma consulta.
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < entrada.empresaIds.length; i += 100) {
    const lote = entrada.empresaIds.slice(i, i + 100);
    const marcadores = lote.map(() => "?").join(",");
    const { rows: parte } = await banco.execute({
      sql: `SELECT e.id AS empresa_id, e.email, l.id AS lead_id
            FROM empresas e
            LEFT JOIN leads l ON l.empresa_id = e.id
            WHERE e.id IN (${marcadores})`,
      args: lote,
    });
    rows.push(...parte);
  }

  const comEmail = rows.filter((r) => r.email && String(r.email).trim() !== "");
  const id = novoId();

  const statements: Array<{ sql: string; args: (string | number | null)[] }> = [
    {
      sql: `INSERT INTO campanhas (id, nome, descricao, status, total_leads) VALUES (?, ?, ?, 'rascunho', ?)`,
      args: [id, entrada.nome, entrada.descricao ?? null, comEmail.length],
    },
  ];

  for (const r of comEmail) {
    let leadId = r.lead_id ? String(r.lead_id) : null;

    if (!leadId) {
      leadId = novoId();
      statements.push({
        sql: `INSERT INTO leads (id, empresa_id) VALUES (?, ?)`,
        args: [leadId, String(r.empresa_id)],
      });
    }

    statements.push(
      {
        sql: `INSERT INTO campanha_leads (campanha_id, lead_id) VALUES (?, ?)`,
        args: [id, leadId],
      },
      {
        sql: `INSERT INTO envios (id, campanha_id, lead_id, canal, status) VALUES (?, ?, ?, 'email', 'pendente')`,
        args: [novoId(), id, leadId],
      },
    );
  }

  // O primeiro job: gerar os e-mails. O resto encadeia sozinho.
  if (comEmail.length > 0) {
    statements.push({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'gerar_emails', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ campanhaId: id })],
    });
  }

  await banco.batch(statements, "write");

  return { id, incluidas: comEmail.length, semEmail: rows.length - comEmail.length };
}

export async function listarCampanhas(): Promise<Campanha[]> {
  const { rows } = await getBanco().execute(
    `SELECT id, nome, descricao, status, total_leads, enviados, falhas, criado_em
     FROM campanhas ORDER BY criado_em DESC LIMIT 50`,
  );
  return planos<Campanha>(rows);
}

export async function obterCampanha(id: string): Promise<{ campanha: Campanha; envios: EnvioListado[] } | null> {
  const banco = getBanco();
  const { rows: c } = await banco.execute({
    sql: `SELECT id, nome, descricao, status, total_leads, enviados, falhas, criado_em FROM campanhas WHERE id = ?`,
    args: [id],
  });
  const campanha = c[0] ? plano<Campanha>(c[0]) : undefined;
  if (!campanha) return null;

  const { rows } = await banco.execute({
    sql: `SELECT en.id, en.status, en.assunto, en.corpo, en.erro, en.enviado_em,
                 e.nome AS empresa_nome, e.email, e.pais
          FROM envios en
          JOIN leads l ON l.id = en.lead_id
          JOIN empresas e ON e.id = l.empresa_id
          WHERE en.campanha_id = ?
          ORDER BY en.status, e.nome`,
    args: [id],
  });

  return { campanha, envios: planos<EnvioListado>(rows) };
}

export async function alternarPausa(id: string): Promise<StatusCampanha | null> {
  const banco = getBanco();
  const { rows } = await banco.execute({ sql: `SELECT status FROM campanhas WHERE id = ?`, args: [id] });
  const atual = rows[0]?.status as StatusCampanha | undefined;
  if (!atual) return null;

  const novo: StatusCampanha | null =
    atual === "em_envio" ? "pausada" : atual === "pausada" ? "em_envio" : null;
  if (!novo) return atual;

  await banco.execute({ sql: `UPDATE campanhas SET status = ? WHERE id = ?`, args: [novo, id] });

  // Retomar precisa de um job novo — o anterior já terminou ao ver "pausada".
  if (novo === "em_envio") {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'envio_email', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ campanhaId: id })],
    });
  }
  return novo;
}

export { agora };
