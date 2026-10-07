import type { Client } from "@libsql/client";

import { agora } from "@/db/cliente";
import type { Job, PayloadBusca } from "@/db/tipos";
import { processarAnaliseMassa, type PayloadAnaliseMassa } from "@/worker/handlers/analise-massa";
import { processarAvaliacaoSites, type PayloadAvaliarSite } from "@/worker/handlers/avaliar-site";
import { processarBusca } from "@/worker/handlers/busca";
import { processarBuscaProvedor, type PayloadBuscaProvedor } from "@/worker/handlers/busca-provedor";
import { processarEnvioCampanha, processarPreparo, type PayloadCampanhaV2 } from "@/worker/handlers/campanha-v2";
import { processarEnriquecimento, type PayloadEnriquecer } from "@/worker/handlers/enriquecer-email";

/**
 * Despacho de jobs, compartilhado entre o worker (GitHub Actions) e a
 * execução imediata dentro de uma requisição (`after()` nas rotas).
 */

export function despachar(banco: Client, job: Pick<Job, "tipo" | "payload">): Promise<string> {
  const payload = JSON.parse(job.payload) as unknown;
  switch (job.tipo) {
    case "busca":
      return processarBusca(banco, payload as PayloadBusca);
    case "busca_google":
      return processarBuscaProvedor(banco, payload as PayloadBuscaProvedor);
    case "analise_ia": {
      // Jobs antigos ({ limite }) não têm lista: não há o que fazer.
      const p = payload as Partial<PayloadAnaliseMassa>;
      if (!Array.isArray(p.leadIds)) return Promise.resolve("job de análise antigo ignorado");
      return processarAnaliseMassa(banco, p as PayloadAnaliseMassa);
    }
    case "avaliar_site":
      return processarAvaliacaoSites(banco, payload as PayloadAvaliarSite);
    case "enriquecer_email":
      return processarEnriquecimento(banco, payload as PayloadEnriquecer);
    case "preparar_campanha":
    case "gerar_emails":
      return processarPreparo(banco, payload as PayloadCampanhaV2);
    case "enviar_campanha":
    case "envio_email":
      return processarEnvioCampanha(banco, payload as PayloadCampanhaV2);
    default:
      return Promise.reject(new Error(`Tipo de job desconhecido: ${job.tipo}`));
  }
}

const LEASE_MINUTOS = 10;

function emMinutos(minutos: number): string {
  return new Date(Date.now() + minutos * 60_000).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Executa UM job específico agora, se ninguém o pegou ainda. Usado pelo
 * `after()` da rota de busca: a busca começa na hora, sem esperar o
 * worker. A reserva é a mesma do worker (UPDATE condicional), então os
 * dois nunca processam o mesmo job; se falhar aqui, o job volta para a
 * fila e o worker tenta de novo.
 */
export async function executarAgora(banco: Client, jobId: string): Promise<void> {
  const { rowsAffected } = await banco.execute({
    sql: `UPDATE jobs SET status = 'em_andamento', lease_ate = ?, tentativas = tentativas + 1, atualizado_em = ?
          WHERE id = ? AND status = 'pendente'`,
    args: [emMinutos(LEASE_MINUTOS), agora(), jobId],
  });
  if (rowsAffected === 0) return;

  const { rows } = await banco.execute({ sql: `SELECT tipo, payload FROM jobs WHERE id = ?`, args: [jobId] });
  const job = rows[0] as unknown as Pick<Job, "tipo" | "payload"> | undefined;
  if (!job) return;

  try {
    await despachar(banco, job);
    await banco.execute({
      sql: `UPDATE jobs SET status = 'concluido', erro = NULL, atualizado_em = ? WHERE id = ?`,
      args: [agora(), jobId],
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const semConfiguracao = Boolean((erro as { semConfiguracao?: boolean }).semConfiguracao);
    // Falta de configuração não melhora tentando de novo: vira erro já.
    await banco.execute({
      sql: `UPDATE jobs SET status = ?, erro = ?, lease_ate = NULL, disponivel_em = ?, atualizado_em = ? WHERE id = ?`,
      args: [semConfiguracao ? "erro" : "pendente", mensagem, semConfiguracao ? null : emMinutos(2), agora(), jobId],
    });
    if (job.tipo === "busca_google" || job.tipo === "busca") {
      const { buscaId } = JSON.parse(job.payload) as { buscaId: string };
      await banco.execute({
        sql: semConfiguracao
          ? `UPDATE buscas SET status = 'erro', erro = ? WHERE id = ?`
          : `UPDATE buscas SET erro = ? WHERE id = ?`,
        args: [semConfiguracao ? mensagem : `${mensagem} Tentando de novo em instantes.`, buscaId],
      });
    }
  }
}
