import type { Client } from "@libsql/client";

import { novoId } from "@/db/cliente";
import { ErroIA } from "@/integrations/ai";
import { notificar } from "@/integrations/notificacoes";
import { analisarEGravar, gerarAbordagens } from "@/services/inteligencia";

/**
 * Modo em massa: "Analisar selecionados" e "Gerar mensagens".
 *
 * O payload carrega a lista de leads que FALTA processar. Cada rodada
 * processa o que cabe no orçamento e reenfileira o resto — assim uma
 * seleção de 1000 leads anda sozinha, no ritmo da cota da IA.
 */

export type PayloadAnaliseMassa = {
  leadIds: string[];
  analisar: boolean;
  gerarMensagens: boolean;
  /** Disparado sozinho após uma busca: sem IA configurada, não incomoda. */
  automatico?: boolean;
  /** Orçamento de tempo desta rodada (execução imediata numa requisição). */
  orcamentoMs?: number;
  /** Para a notificação final. */
  total?: number;
  falhas?: number;
};

const ORCAMENTO_MS = 3 * 60 * 1000;

export async function processarAnaliseMassa(banco: Client, p: PayloadAnaliseMassa): Promise<string> {
  const inicio = Date.now();
  const total = p.total ?? p.leadIds.length;
  let falhas = p.falhas ?? 0;
  let feitos = 0;
  const restantes = [...p.leadIds];

  while (restantes.length > 0 && Date.now() - inicio < (p.orcamentoMs ?? ORCAMENTO_MS)) {
    const leadId = restantes[0];
    try {
      if (p.analisar) await analisarEGravar(banco, leadId);
      if (p.gerarMensagens) await gerarAbordagens(banco, leadId);
      feitos += 1;
    } catch (erro) {
      if (erro instanceof ErroIA && (erro.temporario || erro.semConfiguracao)) {
        // Cota ou falta de chave: devolve a fila inteira para depois.
        if (erro.semConfiguracao) {
          if (p.automatico) return "IA não configurada — análise automática ignorada";
          await notificar(banco, { tipo: "erro_campanha", titulo: "IA não configurada", corpo: erro.message, link: "/configuracoes?aba=integracoes" });
          return `parado: ${erro.message}`;
        }
        // Cota: sem nada feito, o erro sobe e o worker espera meia hora.
        if (feitos === 0) throw erro;
        break;
      }
      falhas += 1;
      console.error(`  lead ${leadId}: ${erro instanceof Error ? erro.message : erro}`);
    }
    restantes.shift();
  }

  if (restantes.length > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'analise_ia', ?, 'pendente')`,
      args: [novoId(), JSON.stringify({ ...p, orcamentoMs: undefined, leadIds: restantes, total, falhas } satisfies PayloadAnaliseMassa)],
    });
  } else if (!p.automatico) {
    await notificar(banco, {
      tipo: "oportunidade",
      titulo: p.gerarMensagens && !p.analisar ? "Mensagens geradas" : "Análise concluída",
      corpo: `${total - falhas} de ${total} lead(s) processado(s)${falhas > 0 ? `, ${falhas} com falha` : ""}.`,
      link: "/leads?aba=abordar",
    });
  }

  return `${feitos} processado(s), ${restantes.length} restante(s), ${falhas} falha(s)`;
}
