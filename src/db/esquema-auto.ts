import type { Client } from "@libsql/client";

/**
 * Atualizações de banco que se aplicam sozinhas quando o servidor sobe
 * (src/instrumentation.ts) — sem o operador precisar rodar comando.
 *
 * Só entram aqui mudanças ADITIVAS e idempotentes: criar tabela que não
 * existe, acrescentar coluna que falta. Cada passo confere antes de
 * mexer, então rodar duas vezes (dois servidores subindo juntos) é
 * inofensivo. Recriar tabela ou mover dados em massa continua sendo
 * migração manual, em db/migracoes; reclassificações pequenas e
 * idempotentes (como a do cardápio) podem entrar aqui.
 */

async function temColuna(banco: Client, tabela: string, coluna: string): Promise<boolean> {
  const { rows } = await banco.execute(`PRAGMA table_info(${tabela})`);
  return rows.some((r) => String(r.name) === coluna);
}

/** `esquema`: só cria tabela/coluna — entra no esquema com que nasce o banco de um assinante. */
type MigracaoAuto = { nome: string; esquema?: boolean; aplicar: (banco: Client) => Promise<void> };

export const MIGRACOES_AUTO: MigracaoAuto[] = [
  {
    nome: "auto_0013_projetos_prompts_custo",
    esquema: true,
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
  {
    // Restaurante/hamburgueria cujo "site" no Google é só cardápio de
    // plataforma (Brendi, Anota Aí, iFood…) passa a contar como sem site
    // próprio. Reclassifica o que já estava salvo; buscas novas já entram
    // assim. Só mexe em quem casa com as duas regras — rodar de novo não muda nada.
    nome: "auto_0015_plataforma_nao_e_site",
    async aplicar(banco) {
      const { ehAlimentacao, ehBeleza, ehRedeSocial, plataformaDoLink, plataformaValeNoRamo } = await import("@/lib/leads/classificacao");
      const { rows } = await banco.execute(`SELECT id, website, categoria, categoria_rotulo FROM empresas WHERE status_site = 'tem_site' AND website IS NOT NULL`);
      const ramo = (r: (typeof rows)[number]) => `${r.categoria ?? ""} ${r.categoria_rotulo ?? ""}`;
      const comida = rows.filter((r) => ehAlimentacao(ramo(r)) || ehBeleza(ramo(r)));
      const ids = rows
        .filter((r) => ehRedeSocial(r.website as string) || plataformaValeNoRamo(plataformaDoLink(r.website as string), ramo(r)))
        .map((r) => String(r.id));
      // Os demais de alimentação com "site" voltam para a fila de avaliação:
      // a visita descobre domínio próprio que só redireciona para o cardápio
      // (majordelivery.com.br → Brendi) ou loja de plataforma com domínio próprio.
      const revisitar = comida.map((r) => String(r.id)).filter((id) => !ids.includes(id));
      for (let i = 0; i < revisitar.length; i += 50) {
        const lote = revisitar.slice(i, i + 50);
        await banco.execute({ sql: `UPDATE empresas SET site_avaliado_em = NULL WHERE id IN (${lote.map(() => "?").join(",")})`, args: lote });
      }
      if (revisitar.length > 0) {
        const { enfileirarUmaVez } = await import("@/worker/handlers/busca-provedor");
        await enfileirarUmaVez(banco, "avaliar_site", { limite: 20 });
      }
      for (let i = 0; i < ids.length; i += 50) {
        const lote = ids.slice(i, i + 50);
        await banco.execute({
          sql: `UPDATE empresas SET status_site = 'rede_social', dominio = NULL, site_qualidade = NULL WHERE id IN (${lote.map(() => "?").join(",")})`,
          args: lote,
        });
      }
      if (ids.length > 0) {
        const { recalcularScores } = await import("@/services/registro");
        await recalcularScores(banco, ids);
      }
      console.log(`[esquema-auto] plataforma não é site: ${ids.length} reclassificada(s), ${revisitar.length} de alimentação/beleza para revisitar`);
    },
  },
];

/**
 * Tabelas de controle do SaaS — só no banco principal (o do dono): contas,
 * usuários, planos, faturas e uso do mês. O banco de cada assinante não
 * tem nada disso; ele só guarda a carteira dele.
 */
export const MIGRACOES_CONTROLE: MigracaoAuto[] = [
  {
    nome: "auto_0016_saas_controle",
    async aplicar(banco) {
      await banco.batch(
        [
          `CREATE TABLE IF NOT EXISTS contas (
            id                   TEXT PRIMARY KEY,
            nome                 TEXT NOT NULL,
            plano                TEXT NOT NULL DEFAULT 'essencial',
            status               TEXT NOT NULL DEFAULT 'teste',      -- teste | ativa | atrasada | cancelada | bloqueada
            valida_ate           TEXT,
            banco_tipo           TEXT NOT NULL DEFAULT 'pendente',   -- principal | d1 | arquivo | pendente
            banco_ref            TEXT,
            documento            TEXT,
            telefone             TEXT,
            asaas_cliente_id     TEXT,
            asaas_assinatura_id  TEXT,
            origem               TEXT,
            observacao           TEXT,
            criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em        TEXT NOT NULL DEFAULT (datetime('now')),
            cancelada_em         TEXT
          )`,
          `CREATE INDEX IF NOT EXISTS contas_status_idx ON contas (status, valida_ate)`,
          `CREATE INDEX IF NOT EXISTS contas_assinatura_idx ON contas (asaas_assinatura_id)`,
          `CREATE TABLE IF NOT EXISTS usuarios (
            id                TEXT PRIMARY KEY,
            conta_id          TEXT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
            nome              TEXT NOT NULL,
            email             TEXT NOT NULL COLLATE NOCASE UNIQUE,
            senha_hash        TEXT,
            papel             TEXT NOT NULL DEFAULT 'dono',          -- dono (da conta) | membro
            admin             INTEGER NOT NULL DEFAULT 0,            -- 1 = dono do SaaS
            ativo             INTEGER NOT NULL DEFAULT 1,
            ultimo_acesso_em  TEXT,
            criado_em         TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS usuarios_conta_idx ON usuarios (conta_id)`,
          `CREATE TABLE IF NOT EXISTS planos (
            id              TEXT PRIMARY KEY,
            nome            TEXT NOT NULL,
            descricao       TEXT,
            preco_centavos  INTEGER NOT NULL,
            destaque        INTEGER NOT NULL DEFAULT 0,
            ordem           INTEGER NOT NULL DEFAULT 0,
            ativo           INTEGER NOT NULL DEFAULT 1,
            limites         TEXT NOT NULL DEFAULT '{}',
            atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS faturas (
            id                  TEXT PRIMARY KEY,
            conta_id            TEXT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
            asaas_pagamento_id  TEXT UNIQUE,
            plano               TEXT,
            valor_centavos      INTEGER NOT NULL DEFAULT 0,
            status              TEXT NOT NULL DEFAULT 'pendente',    -- pendente | paga | atrasada | estornada | cancelada
            forma               TEXT,
            vencimento          TEXT,
            pago_em             TEXT,
            link                TEXT,
            criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em       TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS faturas_conta_idx ON faturas (conta_id, criado_em DESC)`,
          `CREATE TABLE IF NOT EXISTS uso_contas (
            conta_id  TEXT NOT NULL,
            mes       TEXT NOT NULL,
            chave     TEXT NOT NULL,
            valor     INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (conta_id, mes, chave)
          )`,
          `CREATE TABLE IF NOT EXISTS redefinicoes_senha (
            token_hash  TEXT PRIMARY KEY,
            usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            expira_em   TEXT NOT NULL,
            usado_em    TEXT
          )`,
          // A conta do dono: o banco de sempre, plano sem limite.
          `INSERT OR IGNORE INTO contas (id, nome, plano, status, banco_tipo) VALUES ('principal', 'Vynexa', 'dono', 'ativa', 'principal')`,
        ],
        "write",
      );
    },
  },
];

const emAndamento = new WeakMap<Client, Promise<string[]>>();

/**
 * Aplica o que falta. Uma vez por processo e por banco; nunca lança (o
 * painel não pode cair por isso). `principal` inclui as tabelas de controle.
 */
export function garantirEsquema(banco: Client, opcoes: { principal?: boolean } = { principal: true }): Promise<string[]> {
  const existente = emAndamento.get(banco);
  if (existente) return existente;
  const lista = opcoes.principal ? [...MIGRACOES_AUTO, ...MIGRACOES_CONTROLE] : MIGRACOES_AUTO;
  const p = (async () => {
    const aplicadas: string[] = [];
    try {
      await banco.execute(`CREATE TABLE IF NOT EXISTS migracoes_aplicadas (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL DEFAULT (datetime('now')))`);
      const { rows } = await banco.execute(`SELECT nome FROM migracoes_aplicadas WHERE nome LIKE 'auto_%'`);
      const feitas = new Set(rows.map((r) => String(r.nome)));
      for (const m of lista) {
        if (feitas.has(m.nome)) continue;
        await m.aplicar(banco);
        await banco.execute({ sql: `INSERT OR IGNORE INTO migracoes_aplicadas (nome) VALUES (?)`, args: [m.nome] });
        aplicadas.push(m.nome);
      }
    } catch (erro) {
      console.error("[esquema-auto]", erro instanceof Error ? erro.message : erro);
      emAndamento.delete(banco); // tenta de novo na próxima vez
    }
    return aplicadas;
  })();
  emAndamento.set(banco, p);
  return p;
}
