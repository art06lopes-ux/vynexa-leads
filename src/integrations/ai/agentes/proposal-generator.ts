import { obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";

import { blocoFatos, blocoRemetente, REGRAS_ABSOLUTAS, SaidaInvalida, validarTexto, type DadosLead, type ProdutoCatalogo, type Remetente } from "./contexto";

/**
 * ProposalGenerator — o texto da proposta comercial.
 *
 * O modelo escreve contexto, problema, solução e próximos passos. O
 * PREÇO não passa por ele: vem do produto do catálogo (ou do valor que o
 * operador digitar) e é montado pelo código na proposta final.
 */

export type ConteudoProposta = {
  titulo: string;
  contexto: string;
  problema: string;
  solucao: string;
  entregaveis: string[];
  proximosPassos: string[];
};

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    contexto: { type: "string", description: "O negócio do cliente, em 2 ou 3 frases, só com os fatos." },
    problema: { type: "string", description: "O problema de presença digital observado." },
    solucao: { type: "string", description: "O que a Vynexa vai entregar e como isso resolve o problema." },
    entregaveis: { type: "array", items: { type: "string" } },
    proximos_passos: { type: "array", items: { type: "string" } },
  },
  required: ["titulo", "contexto", "problema", "solucao", "entregaveis", "proximos_passos"],
};

export function instrucaoProposta(d: DadosLead, r: Remetente, produto: ProdutoCatalogo | null, entregaveisProduto: string[]): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  return {
    numeros: fatos.numeros,
    instrucao: `Você redige uma proposta comercial da Vynexa Dev para o cliente abaixo.

${blocoRemetente(r)}

${fatos.texto}

PRODUTO PROPOSTO: ${produto ? `${produto.nome}${produto.descricao ? ` — ${produto.descricao}` : ""}` : "a definir pelo vendedor (proponha um site profissional)"}
${entregaveisProduto.length > 0 ? `ENTREGÁVEIS DO PRODUTO (use estes, sem acrescentar itens que não estejam aqui):\n- ${entregaveisProduto.join("\n- ")}` : ""}

${REGRAS_ABSOLUTAS}
- Não escreva valores nem prazos: eles entram depois, pelo vendedor.

Escreva em português do Brasil, em tom profissional e direto. titulo no formato "Proposta — <produto> para <empresa>". De 3 a 7 entregáveis e de 2 a 4 próximos passos.`,
  };
}

export function validarProposta(bruto: unknown, numeros: Set<string>): ConteudoProposta {
  const a = bruto as Record<string, unknown>;
  const lista = (x: unknown) => (Array.isArray(x) ? x.map(String).filter((s) => s.trim()) : []);
  const entregaveis = lista(a?.entregaveis);
  const passos = lista(a?.proximos_passos);
  if (entregaveis.length === 0) throw new SaidaInvalida("proposta sem entregáveis.");
  const v = (campo: string, texto: unknown, maximo = 1200) => validarTexto(String(texto ?? ""), { numeros, campo, maximo });
  return {
    titulo: v("titulo", a.titulo, 160),
    contexto: v("contexto", a.contexto),
    problema: v("problema", a.problema),
    solucao: v("solucao", a.solucao, 1800),
    entregaveis: entregaveis.slice(0, 8).map((e, i) => v(`entregável ${i + 1}`, e, 240)),
    proximosPassos: passos.slice(0, 5).map((p, i) => v(`passo ${i + 1}`, p, 240)),
  };
}

export async function gerarProposta(d: DadosLead, r: Remetente, produto: ProdutoCatalogo | null, entregaveisProduto: string[]): Promise<ConteudoProposta> {
  const { instrucao, numeros } = instrucaoProposta(d, r, produto, entregaveisProduto);
  return validarProposta(await obterIA().gerarJson(instrucao, ESQUEMA), numeros);
}
