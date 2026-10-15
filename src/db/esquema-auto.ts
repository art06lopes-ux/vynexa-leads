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
