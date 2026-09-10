/**
 * Worker da fila.
 *
 * Roda no GitHub Actions a cada 5 minutos. Não é um processo que fica de
 * pé: ele acorda, drena o que der dentro do orçamento de tempo e morre.
 * Por isso todo estado vive no banco, nunca em memória entre execuções.
 *
 *   npm run worker
 */
import { agora, getBanco } from "@/db/cliente";
import type { Job, PayloadBusca } from "@/db/tipos";
import { processarBusca } from "@/worker/handlers/busca";

/**
 * Orçamento de tempo.
 *
 * O cron é de 5 minutos; parar em 4 evita que duas execuções se
 * sobreponham. A sobreposição não corromperia nada — o lease e o UNIQUE
 * em `osm_id` protegem —, mas gastaria minutos de Actions à toa.
 */
const ORCAMENTO_MS = 4 * 60 * 1000;

/** Quanto tempo um job fica reservado antes de outra execução poder retomá-lo. */
const LEASE_MINUTOS = 10;

/**
 * Depois disto o job vira erro em vez de voltar para a fila.
 *
 * Seis e não três: a Overpass é um serviço público gratuito e ficar
 * ocupada é o comportamento normal dela, não uma exceção. Com três, uma
 * tarde movimentada no servidor deles bastava para a busca desistir.
 */
const MAX_TENTATIVAS = 6;

/**
 * Espera antes da próxima tentativa, em minutos por número de tentativa.
 *
 * Cresce a cada falha para não insistir num serviço que já respondeu que
 * está ocupado. Como o cron roda a cada 5 minutos, qualquer espera menor
 * que isso é arredondada para cima na prática.
 */
const ESPERA_MINUTOS = [5, 5, 15, 30, 60, 120];

async function main() {
  const banco = getBanco();
  const inicio = Date.now();

  // Recupera o que ficou preso: um worker morto no meio (o Actions pode
  // ser cancelado a qualquer momento) deixaria o job em 'em_andamento'
  // para sempre sem esta linha.
  const { rowsAffected: recuperados } = await banco.execute({
    sql: `UPDATE jobs SET status = 'pendente', atualizado_em = ?
          WHERE status = 'em_andamento' AND (lease_ate IS NULL OR lease_ate < ?)`,
    args: [agora(), agora()],
  });

  if (recuperados > 0) console.log(`${recuperados} job(s) com lease vencido devolvidos à fila.`);

  let processados = 0;

  while (Date.now() - inicio < ORCAMENTO_MS) {
    const job = await reservarProximo(banco);
    if (job === null) break;

    console.log(`[${job.tipo}] ${job.id} — tentativa ${job.tentativas}`);

    try {
      const resumo = await despachar(banco, job);
      await banco.execute({
        sql: `UPDATE jobs SET status = 'concluido', erro = NULL, atualizado_em = ? WHERE id = ?`,
        args: [agora(), job.id],
      });
      console.log(`  ok — ${resumo}`);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      const desiste = job.tentativas >= MAX_TENTATIVAS;

      const espera = ESPERA_MINUTOS[Math.min(job.tentativas - 1, ESPERA_MINUTOS.length - 1)] ?? 5;

      await banco.execute({
        sql: `UPDATE jobs SET status = ?, erro = ?, lease_ate = NULL, disponivel_em = ?, atualizado_em = ?
              WHERE id = ?`,
        args: [
          desiste ? "erro" : "pendente",
          mensagem,
          desiste ? null : emMinutos(espera),
          agora(),
          job.id,
        ],
      });

      // A busca também precisa sair de 'em_andamento', senão a tela fica
      // girando para sempre esperando um job que já desistiu.
      if (desiste && job.tipo === "busca") {
        const { buscaId } = JSON.parse(job.payload) as PayloadBusca;
        await banco.execute({
          sql: `UPDATE buscas SET status = 'erro', erro = ? WHERE id = ?`,
          args: [mensagem, buscaId],
        });
      }

      console.error(
        `  ${desiste ? "desistiu" : `nova tentativa em ~${espera} min`} — ${mensagem}`,
      );
    }

    processados += 1;
  }

  console.log(
    processados === 0
      ? "Nada na fila."
      : `${processados} job(s) processado(s) em ${Math.round((Date.now() - inicio) / 1000)}s.`,
  );
}

/**
 * Reserva o próximo job pendente.
 *
 * O `UPDATE … WHERE id = ? AND status = 'pendente'` é o que torna a
 * reserva segura: se outra execução pegou o mesmo job entre o SELECT e o
 * UPDATE, `rowsAffected` vem zero e este worker simplesmente tenta o
 * próximo, em vez de os dois processarem a mesma coisa.
 */
async function reservarProximo(banco: ReturnType<typeof getBanco>): Promise<Job | null> {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    // `disponivel_em` implementa a espera entre tentativas: um job que
    // acabou de falhar fica invisível para esta consulta até o prazo.
    const { rows } = await banco.execute({
      sql: `SELECT id, tipo, payload, status, tentativas, lease_ate, erro, criado_em, atualizado_em
            FROM jobs
            WHERE status = 'pendente' AND (disponivel_em IS NULL OR disponivel_em <= ?)
            ORDER BY criado_em LIMIT 1`,
      args: [agora()],
    });

    const job = rows[0] as unknown as Job | undefined;
    if (!job) return null;

    const { rowsAffected } = await banco.execute({
      sql: `UPDATE jobs
            SET status = 'em_andamento', lease_ate = ?, tentativas = tentativas + 1, atualizado_em = ?
            WHERE id = ? AND status = 'pendente'`,
      args: [emMinutos(LEASE_MINUTOS), agora(), job.id],
    });

    if (rowsAffected === 1) return { ...job, tentativas: job.tentativas + 1 };
  }

  return null;
}

/** Instante daqui a N minutos, no formato do `datetime('now')` do SQLite. */
function emMinutos(minutos: number): string {
  return new Date(Date.now() + minutos * 60_000).toISOString().replace("T", " ").slice(0, 19);
}

function despachar(banco: ReturnType<typeof getBanco>, job: Job): Promise<string> {
  switch (job.tipo) {
    case "busca":
      return processarBusca(banco, JSON.parse(job.payload) as PayloadBusca);
    case "analise_ia":
    case "envio_email":
      // Etapas 2 e 3. Falhar explicitamente é melhor que marcar como
      // concluído em silêncio e o job sumir sem ter feito nada.
      return Promise.reject(new Error(`Handler '${job.tipo}' ainda não implementado.`));
    default:
      return Promise.reject(new Error(`Tipo de job desconhecido: ${job.tipo}`));
  }
}

main().catch((erro) => {
  console.error("\nWorker falhou:\n", erro);
  process.exit(1);
});
