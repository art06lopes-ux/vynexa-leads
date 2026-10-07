import { obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

import { blocoFatos, REGRAS_ABSOLUTAS, SaidaInvalida, validarTexto, type DadosLead, type ProdutoCatalogo } from "./contexto";

/**
 * SalesOpportunityAnalyzer — o que oferecer a este lead.
 *
 * Escolhe o tipo de solução e o produto do CATÁLOGO da Vynexa (nunca
 * inventa produto nem preço: o preço vem do catálogo, em código) e
 * escreve o argumento de venda e o CTA.
 */

export type Solucao = "site" | "agendamento" | "sistema" | "app" | "saas";

export const ROTULO_SOLUCAO: Record<Solucao, string> = {
  site: "Site",
  agendamento: "Sistema de agendamento",
  sistema: "Sistema personalizado",
  app: "Aplicativo",
  saas: "SaaS",
};

export const FRASE_SOLUCAO: Record<Solucao, string> = {
  site: "Este lead parece ser excelente para oferecer um site.",
  agendamento: "Este lead parece mais adequado para um sistema de agendamento.",
  sistema: "Este lead parece precisar de um sistema sob medida.",
  app: "Este lead parece ter espaço para um aplicativo.",
  saas: "Este lead parece ter potencial para uma solução SaaS.",
};

export type OportunidadeVenda = {
  solucao: Solucao;
  produtoId: string | null;
  argumento: string;
  cta: string;
  justificativa: string;
};

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    solucao: { type: "string", enum: ["site", "agendamento", "sistema", "app", "saas"] },
    produto_id: { type: "string", description: "O id de um produto do catálogo, ou vazio se nenhum servir." },
    argumento: { type: "string", description: "Argumento de venda em 2 ou 3 frases, ligado aos fatos." },
    cta: { type: "string", description: "Chamada para ação curta, que convide a uma conversa." },
    justificativa: { type: "string", description: "Uma frase dizendo por que esta solução e este produto." },
  },
  required: ["solucao", "produto_id", "argumento", "cta", "justificativa"],
};

export function instrucaoOportunidade(d: DadosLead, catalogo: ProdutoCatalogo[]): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  const lista =
    catalogo.length > 0
      ? catalogo
          .map((p) => `- id=${p.id} | ${p.nome}${p.tipo ? ` (${p.tipo})` : ""}${p.descricao ? ` — ${p.descricao}` : ""}${p.preco_centavos > 0 ? ` — ${formatarDinheiro(p.preco_centavos, p.moeda)}` : ""}`)
          .join("\n")
      : "(catálogo vazio — deixe produto_id vazio)";

  return {
    numeros: fatos.numeros,
    instrucao: `Você decide o que a Vynexa Dev deve oferecer a este lead.

${fatos.texto}

CATÁLOGO DA VYNEXA
${lista}

${REGRAS_ABSOLUTAS}

COMO DECIDIR
- "agendamento" para negócios que vivem de horário marcado (barbearia, salão, estética, clínica, consultório, personal) quando o lead já tem site razoável ou muita demanda (muitas avaliações).
- "site" quando falta site próprio ou o site é fraco — é o caso mais comum.
- "sistema", "app" ou "saas" só com sinal claro nos fatos; na dúvida, "site".
- produto_id: escolha o produto do catálogo mais coerente com a solução. Copie o id exatamente.

Escreva argumento, cta e justificativa em português do Brasil.`,
  };
}

export function validarOportunidade(bruto: unknown, numeros: Set<string>, catalogo: ProdutoCatalogo[]): OportunidadeVenda {
  const a = bruto as Record<string, unknown>;
  const solucao = String(a?.solucao ?? "") as Solucao;
  if (!(solucao in ROTULO_SOLUCAO)) throw new SaidaInvalida("solução inválida.");
  const id = String(a?.produto_id ?? "").trim();
  // Produto que não existe no catálogo é tratado como "nenhum" — nunca
  // gravamos um id inventado.
  const produtoId = catalogo.some((p) => p.id === id) ? id : null;
  // Preços do catálogo podem ser citados no argumento.
  const extras = catalogo.map((p) => formatarDinheiro(p.preco_centavos, p.moeda)).join(" ");
  const v = (campo: string, texto: unknown, maximo = 500) => validarTexto(String(texto ?? ""), { numeros, campo, maximo, extrasPermitidos: extras });

  return {
    solucao,
    produtoId,
    argumento: v("argumento", a.argumento, 700),
    cta: v("cta", a.cta, 200),
    justificativa: v("justificativa", a.justificativa, 300),
  };
}

export async function analisarOportunidade(d: DadosLead, catalogo: ProdutoCatalogo[]): Promise<OportunidadeVenda> {
  const { instrucao, numeros } = instrucaoOportunidade(d, catalogo);
  return validarOportunidade(await obterIA().gerarJson(instrucao, ESQUEMA), numeros, catalogo);
}
