import type { Client } from "@libsql/client";

/**
 * Atualizações de banco que se aplicam sozinhas quando o servidor sobe
 * (src/instrumentation.ts) — sem o operador precisar rodar comando.
 *
 * Só entram aqui mudanças ADITIVAS e idempotentes: criar tabela que não
 * existe, acrescentar coluna que falta. Cada passo confere antes de
 * mexer, então rodar duas vezes (dois servidores subindo juntos) é
 * inofensivo. Recriar tabela ou mover dados continua sendo migração
 * manual, em db/migracoes.
 */

async function temColuna(banco: Client, tabela: string, coluna: string): Promise<boolean> {
  const { rows } = await banco.execute(`PRAGMA table_info(${tabela})`);
  return rows.some((r) => String(r.name) === coluna);
}

type MigracaoAuto = { nome: string; aplicar: (banco: Client) => Promise<void> };

export const MIGRACOES_AUTO: MigracaoAuto[] = [
  {
    nome: "auto_0013_projetos_prompts_custo",
    async aplicar(banco) {
      // Custo da venda: é o que separa receita de lucro no Início.
      if (!(await temColuna(banco, "vendas", "custo_centavos"))) {
        await banco.execute(`ALTER TABLE vendas ADD COLUMN custo_centavos INTEGER NOT NULL DEFAULT 0`);
      }

      // Projetos entregues (ou em andamento) para os clientes — e a
      // vitrine de sites sai daqui (tipo = site com url).
      await banco.execute(`CREATE TABLE IF NOT EXISTS projetos (
        id              TEXT PRIMARY KEY,
        lead_id         TEXT REFERENCES leads(id) ON DELETE SET NULL,
        cliente_nome    TEXT,
        nome            TEXT NOT NULL,
        tipo            TEXT NOT NULL DEFAULT 'site',        -- site | landing | sistema | loja | app | outro
        status          TEXT NOT NULL DEFAULT 'desenvolvimento', -- briefing | desenvolvimento | revisao | publicado | arquivado
        url             TEXT,
        prazo           TEXT,
        valor_centavos  INTEGER NOT NULL DEFAULT 0,
        custo_centavos  INTEGER NOT NULL DEFAULT 0,
        observacoes     TEXT,
        publicado_em    TEXT,
        criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      await banco.execute(`CREATE INDEX IF NOT EXISTS projetos_lead_idx ON projetos (lead_id)`);
      await banco.execute(`CREATE INDEX IF NOT EXISTS projetos_status_idx ON projetos (status, atualizado_em DESC)`);

      // Prompts gerados no Gerador (para usar com o Claude).
      await banco.execute(`CREATE TABLE IF NOT EXISTS prompts (
        id         TEXT PRIMARY KEY,
        titulo     TEXT NOT NULL,
        modo       TEXT NOT NULL DEFAULT 'ideia',   -- ideia | melhorar
        formato    TEXT NOT NULL DEFAULT 'texto',   -- texto | json
        entrada    TEXT NOT NULL,
        saida      TEXT NOT NULL,
        favorito   INTEGER NOT NULL DEFAULT 0,
        criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      await banco.execute(`CREATE INDEX IF NOT EXISTS prompts_criado_idx ON prompts (criado_em DESC)`);
    },
  },
];

let emAndamento: Promise<string[]> | null = null;

/** Aplica o que falta. Uma vez por processo; nunca lança (o painel não pode cair por isso). */
export function garantirEsquema(banco: Client): Promise<string[]> {
  emAndamento ??= (async () => {
    const aplicadas: string[] = [];
    try {
      await banco.execute(`CREATE TABLE IF NOT EXISTS migracoes_aplicadas (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL DEFAULT (datetime('now')))`);
      const { rows } = await banco.execute(`SELECT nome FROM migracoes_aplicadas WHERE nome LIKE 'auto_%'`);
      const feitas = new Set(rows.map((r) => String(r.nome)));
      for (const m of MIGRACOES_AUTO) {
        if (feitas.has(m.nome)) continue;
        await m.aplicar(banco);
        await banco.execute({ sql: `INSERT OR IGNORE INTO migracoes_aplicadas (nome) VALUES (?)`, args: [m.nome] });
        aplicadas.push(m.nome);
      }
    } catch (erro) {
      console.error("[esquema-auto]", erro instanceof Error ? erro.message : erro);
      emAndamento = null; // tenta de novo na próxima subida
    }
    return aplicadas;
  })();
  return emAndamento;
}
