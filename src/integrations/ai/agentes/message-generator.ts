import { obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";

import {
  blocoFatos,
  blocoRemetente,
  nomeIdioma,
  REGRAS_ABSOLUTAS,
  validarTexto,
  type DadosLead,
  type Remetente,
} from "./contexto";

/**
 * MessageGenerator — as versões de abordagem para um lead.
 *
 * Cinco versões numa chamada: curta, profissional, informal, WhatsApp e
 * DM de Instagram. Todas no idioma do lead. O e-mail tem agente próprio
 * (EmailGenerator), porque precisa de assunto e assinatura.
 */

export type VersoesMensagem = {
  curta: string;
  profissional: string;
  informal: string;
  whatsapp: string;
  instagram: string;
};

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    curta: { type: "string", description: "Uma ou duas frases, direto ao ponto." },
    profissional: { type: "string", description: "Tom formal e cordial, até 5 linhas." },
    informal: { type: "string", description: "Tom leve, de conversa, até 4 linhas." },
    whatsapp: { type: "string", description: "Para WhatsApp: até 3 linhas curtas, sem assinatura." },
    instagram: { type: "string", description: "DM de Instagram: até 3 linhas, leve, sem link." },
  },
  required: ["curta", "profissional", "informal", "whatsapp", "instagram"],
};

export function instrucaoMensagens(d: DadosLead, r: Remetente, argumento: string | null): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  return {
    numeros: fatos.numeros,
    instrucao: `Você escreve a primeira abordagem de venda para uma empresa real.

${blocoRemetente(r)}
QUEM RECEBE: a empresa abaixo. A mensagem é dirigida A ELA.

${fatos.texto}
${argumento ? `\nÂNGULO DE VENDA JÁ DEFINIDO: ${argumento}` : ""}

${REGRAS_ABSOLUTAS}

COMO SOAR
- Como uma pessoa que encontrou a empresa e reparou em algo específico. Nada de "Somos uma empresa especializada em…", "Olá, tudo bem? Somos…", nem lista de serviços.
- Comece pelo que você observou (ex.: "Vi a [nome] no Google e reparei que vocês têm uma avaliação muito boa por aí. Procurei um site próprio de vocês e não achei…"), depois a oportunidade em uma frase, depois uma pergunta curta que convide à resposta.
- Cite o nome da empresa uma vez. Não use colchetes nem placeholders.
- Não abra com "Olá da Vynexa" nem com o nome de quem envia; abra com um cumprimento simples. Não repita o mesmo verbo ("encontrei… não encontrei") — varie: "vi", "reparei", "procurei".
- Frases curtas e naturais, como alguém digitando no celular.
- Idioma de TODAS as versões: ${nomeIdioma(d.empresa.idioma_abordagem)}.`,
  };
}

export function validarMensagens(bruto: unknown, numeros: Set<string>, remetente: string): VersoesMensagem {
  const a = bruto as Record<string, unknown>;
  const v = (campo: keyof VersoesMensagem, maximo: number) =>
    validarTexto(String(a?.[campo] ?? ""), { numeros, campo, maximo, remetente, minimo: 20 });
  return {
    curta: v("curta", 320),
    profissional: v("profissional", 900),
    informal: v("informal", 700),
    whatsapp: v("whatsapp", 500),
    instagram: v("instagram", 500),
  };
}

export async function gerarMensagens(d: DadosLead, r: Remetente, argumento: string | null): Promise<VersoesMensagem> {
  const { instrucao, numeros } = instrucaoMensagens(d, r, argumento);
  return validarMensagens(await obterIA().gerarJson(instrucao, ESQUEMA), numeros, r.nome);
}
