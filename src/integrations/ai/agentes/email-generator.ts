import type { EsquemaResposta } from "@/integrations/ai/tipos";

import {
  blocoFatos,
  blocoRemetente,
  nomeIdioma,
  REGRAS_ABSOLUTAS,
  SaidaInvalida,
  validarTexto,
  type DadosLead,
  type Remetente,
} from "./contexto";
import { gerarConferido } from "./gerar";

/**
 * EmailGenerator — o e-mail de primeira abordagem: assunto, saudação,
 * corpo e CTA. A assinatura NÃO vem do modelo: é a assinatura cadastrada
 * em Configurações, anexada pelo código no envio — o modelo não tem como
 * errar o telefone da Vynexa se nunca escreve o telefone da Vynexa.
 */

export type EmailGerado = { assunto: string; corpo: string };

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    assunto: { type: "string", description: "Até 60 caracteres, específico, em caixa de frase (primeira letra maiúscula, nome da empresa escrito exatamente como nos fatos), sem clickbait." },
    corpo: {
      type: "string",
      description: "Saudação à empresa, 3 a 6 linhas de texto e uma pergunta final. Sem assinatura.",
    },
  },
  required: ["assunto", "corpo"],
};

export function instrucaoEmail(d: DadosLead, r: Remetente, argumento: string | null, cta: string | null): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  return {
    numeros: fatos.numeros,
    instrucao: `Você escreve um e-mail de primeira abordagem para uma empresa real.

${blocoRemetente(r)}
QUEM RECEBE: a empresa abaixo. O e-mail é dirigido A ELA — nunca a ${r.nome}.

${fatos.texto}
${argumento ? `\nÂNGULO DE VENDA: ${argumento}` : ""}${cta ? `\nCTA SUGERIDO: ${cta}` : ""}

${REGRAS_ABSOLUTAS}

FORMATO
- Idioma: ${nomeIdioma(d.empresa.idioma_abordagem)}.
- assunto: específico para esta empresa (ex.: "Uma ideia para a [nome]"), em caixa de frase — primeira letra maiúscula e o nome da empresa exatamente como está nos fatos (nunca tudo minúsculo nem TUDO MAIÚSCULO). Sem placeholders.
- corpo: saudação à equipe da empresa; uma frase sobre o que foi observado; uma sobre a oportunidade; ofereça mostrar uma prévia sem compromisso; termine com uma pergunta curta. NÃO assine — a assinatura é anexada depois.`,
  };
}

export function validarEmailGerado(bruto: unknown, numeros: Set<string>, remetente: string): EmailGerado {
  const a = bruto as Record<string, unknown>;
  const assunto = validarTexto(String(a?.assunto ?? ""), { numeros, campo: "assunto", minimo: 5, maximo: 90 });
  // Quebra de linha no assunto é injeção de cabeçalho de e-mail.
  if (/[\r\n]/.test(assunto)) throw new SaidaInvalida("assunto com quebra de linha.");
  const corpo = validarTexto(String(a?.corpo ?? ""), { numeros, campo: "corpo", minimo: 60, maximo: 1500, remetente });
  // Rede de segurança: assunto todo em minúsculas ganha a inicial maiúscula.
  return { assunto: assunto.charAt(0).toUpperCase() + assunto.slice(1), corpo };
}

export async function gerarEmail(d: DadosLead, r: Remetente, argumento: string | null, cta: string | null): Promise<EmailGerado> {
  const { instrucao, numeros } = instrucaoEmail(d, r, argumento, cta);
  return gerarConferido(instrucao, ESQUEMA, (b) => validarEmailGerado(b, numeros, r.nome));
}
