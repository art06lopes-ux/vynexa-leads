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
import { processarAnaliseIA, type PayloadAnalise } from "@/worker/handlers/analise-ia";
import { processarBusca } from "@/worker/handlers/busca";
import { processarEnvio, processarGeracao, type PayloadCampanha } from "@/worker/handlers/campanha";
import { processarEnriquecimento, type PayloadEnriquecer } from "@/worker/handlers/enriquecer-email";

/**
 * Orçamento de tempo.
 *
 * Dois modos. Sem `WORKER_DURACAO_MIN`, o de sempre: acorda, drena a fila
 * por até 4 minutos e morre — serve para rodar na mão. Com a variável, o
 * modo de plantão do GitHub Actions: fica de pé o tempo pedido, olha a
 * fila a cada 20 segundos e, ao fim, avisa o fluxo para se relançar.
 *
 * O plantão existe porque o cron de 5 minutos do GitHub não é honrado:
 * em repositório público ele virou "a cada 4 ou 5 horas", e uma caçada
 * ficava a tarde inteira "na fila". Com o plantão, o job roda em menos
 * de meio minuto depois de entrar.
 */
const PLANTAO_MIN = Number(process.env.WORKER_DURACAO_MIN) || 0;
const ORCAMENTO_MS = (PLANTAO_MIN > 0 ? PLANTAO_MIN : 4) * 60 * 1000;
const PAUSA_FILA_VAZIA_MS = 20_000;

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
    if (job === null) {
      if (PLANTAO_MIN === 0) break;
      await new Promise((r) => setTimeout(r, PAUSA_FILA_VAZIA_MS));
      continue;
    }

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

  // Plantão acabou por tempo: pede ao fluxo que dispare o próximo.
  if (PLANTAO_MIN > 0 && process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_OUTPUT, "continuar=true\n");
  }
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
      return processarAnaliseIA(banco, JSON.parse(job.payload) as PayloadAnalise);
    case "enriquecer_email":
      return processarEnriquecimento(banco, JSON.parse(job.payload) as PayloadEnriquecer);
    case "gerar_emails":
      return processarGeracao(banco, JSON.parse(job.payload) as PayloadCampanha);
    case "envio_email":
      return processarEnvio(banco, JSON.parse(job.payload) as PayloadCampanha);
    default:
      return Promise.reject(new Error(`Tipo de job desconhecido: ${job.tipo}`));
  }
}

main().catch((erro) => {
  console.error("\nWorker falhou:\n", erro);
  process.exit(1);
});
