import { obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";
import type { Prioridade } from "@/db/tipos";

import { blocoFatos, REGRAS_ABSOLUTAS, SaidaInvalida, validarTexto, type DadosLead } from "./contexto";

/**
 * LeadAnalyzer — lê os fatos e escreve o diagnóstico para o operador.
 *
 * Responde "quem é essa empresa e por que vale (ou não) abordar". Não
 * escreve mensagem para o cliente (é o MessageGenerator) nem escolhe o
 * produto (é o SalesOpportunityAnalyzer). Tudo em português: é para o
 * operador ler.
 */

export type AnaliseLead = {
  resumo: string;
  diagnostico: string;
  oportunidades: string[];
  porQuePrecisa: string;
  prioridade: Prioridade;
};

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    resumo: { type: "string", description: "Duas frases: o que é a empresa e onde está, só com os fatos." },
    diagnostico: {
      type: "string",
      description: "Um parágrafo curto sobre a presença digital observada e a oportunidade comercial.",
    },
    oportunidades: { type: "array", items: { type: "string" }, description: "De 2 a 4 oportunidades concretas, uma frase cada." },
    por_que_precisa: { type: "string", description: "Uma frase: por que este negócio se beneficiaria de um site ou sistema." },
    prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
  },
  required: ["resumo", "diagnostico", "oportunidades", "por_que_precisa", "prioridade"],
};

export function instrucaoLeadAnalyzer(d: DadosLead): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  return {
    numeros: fatos.numeros,
    instrucao: `Você é analista comercial da Vynexa Dev, estúdio que vende sites, sistemas, aplicativos e SaaS.
Analise o lead abaixo para o vendedor decidir se aborda.

${fatos.texto}

${REGRAS_ABSOLUTAS}

O QUE ESCREVER (tudo em português do Brasil, para o VENDEDOR ler — em terceira pessoa, falando SOBRE a empresa, nunca COM ela: "não encontramos um site próprio", jamais "o site de vocês")
- resumo: duas frases objetivas.
- diagnostico: exemplo de tom — "Esta empresa possui boa reputação no Google, mas não possui um site próprio. Isso representa uma oportunidade para apresentar uma página profissional com serviços, localização, avaliações e botão direto para WhatsApp." Adapte aos fatos reais.
- oportunidades: o que dá para oferecer, ligado ao que foi observado.
- prioridade: alta quando há canal de contato e falta site (ou o site é fraco); baixa quando não há como contatar ou o site já é excelente.`,
  };
}

export function validarAnaliseLead(bruto: unknown, numeros: Set<string>): AnaliseLead {
  const a = bruto as Record<string, unknown>;
  const prioridade = String(a?.prioridade ?? "");
  if (!["alta", "media", "baixa"].includes(prioridade)) throw new SaidaInvalida("prioridade inválida.");
  const oportunidades = Array.isArray(a?.oportunidades) ? a.oportunidades.map(String).filter((s) => s.trim()) : [];
  if (oportunidades.length === 0) throw new SaidaInvalida("sem oportunidades.");
  const v = (campo: string, texto: unknown, maximo = 900) => validarTexto(String(texto ?? ""), { numeros, campo, maximo });

  return {
    resumo: v("resumo", a.resumo, 500),
    diagnostico: v("diagnostico", a.diagnostico),
    oportunidades: oportunidades.slice(0, 4).map((o, i) => v(`oportunidade ${i + 1}`, o, 300)),
    porQuePrecisa: v("por_que_precisa", a.por_que_precisa, 400),
    prioridade: prioridade as Prioridade,
  };
}

export async function analisarLead(d: DadosLead): Promise<AnaliseLead> {
  const { instrucao, numeros } = instrucaoLeadAnalyzer(d);
  return validarAnaliseLead(await obterIA().gerarJson(instrucao, ESQUEMA), numeros);
}
