import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Empresa } from "@/db/tipos";
import { decidirCanal, ESQUEMA_ANALISE, montarInstrucao, validarAnalise } from "@/lib/ia/analise";
import { ErroGemini, pedirJson } from "@/lib/ia/gemini";

export type PayloadAnalise = {
  /** Quantas empresas processar nesta rodada. */
  limite: number;
  /** Reanalisar quem já tem lead, em vez de só as pendentes. */
  refazer?: boolean;
};

/**
 * Teto por job.
 *
 * Alto de propósito: quem protege contra estourar o worker é o
 * `ORCAMENTO_MS` abaixo (para de pedir mais análise 3 minutos depois de
 * começar), não este número. Um teto baixo (era 20) só atrasava: com a
 * espera de 2 s entre chamadas ao Gemini, o orçamento já permite ~90
 * por rodada — punha o job para se reenfileirar sem necessidade antes
 * de aproveitar o tempo que tinha. O que sobrar do orçamento ainda vira
 * um job novo no fim, e a fila drena sozinha dentro do mesmo plantão.
 */
export const TETO_POR_JOB = 100_000;

/** Para antes de estourar o orçamento do worker e ser morto no meio. */
const ORCAMENTO_MS = 3 * 60 * 1000;

export async function processarAnaliseIA(banco: Client, payload: PayloadAnalise): Promise<string> {
  const limite = Math.min(Math.max(payload.limite, 1), TETO_POR_JOB);
  const inicio = Date.now();

  const { rows } = await banco.execute({
    sql: payload.refazer
      ? `SELECT * FROM empresas ORDER BY criado_em DESC LIMIT ?`
      : // `LEFT JOIN … IS NULL`: só quem ainda não tem análise. Sem isso,
        // cada execução reanalisaria as mesmas empresas e queimaria a cota
        // do free tier sem produzir nada novo.
        // `analisado_em IS NULL` e não `l.id IS NULL`: abrir o WhatsApp de
        // uma empresa cria o lead (etapa "contatado") antes da análise, e
        // essa empresa ficava para sempre sem mensagem.
        `SELECT e.* FROM empresas e
         LEFT JOIN leads l ON l.empresa_id = e.id
         WHERE l.analisado_em IS NULL
         ORDER BY e.criado_em DESC
         LIMIT ?`,
    args: [limite],
  });

  const empresas = rows as unknown as Empresa[];
  if (empresas.length === 0) return "nada a analisar";

  let analisadas = 0;
  const falhas: string[] = [];

  for (const empresa of empresas) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;

    try {
      const canal = decidirCanal(empresa);
      const bruto = await pedirJson<unknown>(montarInstrucao(empresa, canal), ESQUEMA_ANALISE);
      const analise = validarAnalise(bruto);

      await banco.execute({
        // `ON CONFLICT(empresa_id)`: reanálise atualiza a linha em vez de
        // acumular versões. O `status` fica de fora do UPDATE de
        // propósito — se o operador já marcou "contatado", uma reanálise
        // não pode jogar isso fora.
        sql: `INSERT INTO leads (
                id, empresa_id, score_oportunidade, motivo_problema,
                mensagem_gerada, canal_recomendado, analisado_em
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(empresa_id) DO UPDATE SET
                score_oportunidade = excluded.score_oportunidade,
                motivo_problema    = excluded.motivo_problema,
                mensagem_gerada    = excluded.mensagem_gerada,
                canal_recomendado  = excluded.canal_recomendado,
                analisado_em       = excluded.analisado_em,
                atualizado_em      = ?`,
        args: [
          novoId(),
          empresa.id,
          analise.score_oportunidade,
          analise.motivo_problema,
          analise.mensagem,
          canal,
          agora(),
          agora(),
        ],
      });

      analisadas += 1;
    } catch (erro) {
      // Cota estourada ou serviço fora do ar interrompe tudo: as
      // próximas falhariam igual, e insistir só gasta o que restou da
      // cota. O backoff do job cuida de tentar de novo mais tarde.
      if (erro instanceof ErroGemini && erro.temporario) {
        if (analisadas === 0) throw erro;
        break;
      }

      // Falha de uma empresa só não derruba o lote. Registrar e seguir é
      // melhor do que perder as dezenove que teriam dado certo. E fica
      // registrada NA empresa (lead sem score, com o motivo): sem isso a
      // mesma empresa voltava a cada rodada e travava a fila.
      const motivo = erro instanceof Error ? erro.message : String(erro);
      falhas.push(`${empresa.nome}: ${motivo}`);
      await banco.execute({
        sql: `INSERT INTO leads (id, empresa_id, motivo_problema, analisado_em)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(empresa_id) DO UPDATE SET
                motivo_problema = excluded.motivo_problema,
                analisado_em = excluded.analisado_em,
                atualizado_em = excluded.analisado_em`,
        args: [novoId(), empresa.id, `A análise falhou: ${motivo.slice(0, 200)}`, agora()],
      });
    }
  }

  const restantes = await contarPendentes(banco);

  // Enfileira a continuação. É o que faz a fila drenar sozinha a cada
  // execução do cron, sem o operador precisar clicar de novo.
  if (restantes > 0 && analisadas > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ limite: TETO_POR_JOB } satisfies PayloadAnalise)],
    });
  }

  const resumo = `${analisadas} analisada(s), ${restantes} na fila`;
  return falhas.length > 0 ? `${resumo} — ${falhas.length} falha(s): ${falhas[0]}` : resumo;
}

export async function contarPendentes(banco: Client): Promise<number> {
  const { rows } = await banco.execute(
    `SELECT COUNT(*) AS n FROM empresas e
     LEFT JOIN leads l ON l.empresa_id = e.id
     WHERE l.analisado_em IS NULL`,
  );
  return Number(rows[0]?.n ?? 0);
}
