import type { EsquemaResposta } from "@/integrations/ai/tipos";

import { blocoFatos, blocoRemetente, nomeIdioma, REGRAS_ABSOLUTAS, SaidaInvalida, validarTexto, type DadosLead, type Remetente } from "./contexto";
import { gerarConferido } from "./gerar";

/**
 * FollowUpGenerator — as retomadas depois da primeira abordagem.
 *
 * Só escreve. Quem decide se e quando um follow-up sai é a campanha,
 * configurada e autorizada pelo operador (`campanhas.followup_ativo`).
 * Um lead que respondeu ou pediu para não ser contatado nunca recebe.
 */

export type FollowUp = { dia: number; assunto: string; corpo: string };

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    followups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dia: { type: "integer" },
          assunto: { type: "string" },
          corpo: { type: "string" },
        },
        required: ["dia", "assunto", "corpo"],
      },
    },
  },
  required: ["followups"],
};

export function instrucaoFollowUp(
  d: DadosLead,
  r: Remetente,
  primeira: { assunto: string | null; corpo: string },
  dias: number[],
): { instrucao: string; numeros: Set<string> } {
  const fatos = blocoFatos(d);
  return {
    numeros: fatos.numeros,
    instrucao: `Você escreve follow-ups de uma abordagem que ainda não teve resposta.

${blocoRemetente(r)}
QUEM RECEBE: a empresa abaixo.

${fatos.texto}

PRIMEIRA MENSAGEM JÁ ENVIADA
${primeira.assunto ? `Assunto: ${primeira.assunto}\n` : ""}${primeira.corpo}

${REGRAS_ABSOLUTAS}

ESCREVA um follow-up para cada dia: ${dias.join(", ")} (dias depois da primeira mensagem).
- Cada um mais curto que o anterior: 2 a 4 linhas.
- Retome sem cobrar ("só passando para…"), acrescente UM ponto novo baseado nos fatos, termine com pergunta simples.
- O último é a última tentativa: educado, deixando a porta aberta, sem drama.
- assunto: "Re: " + o assunto original, ou um assunto curto novo.
- Idioma: ${nomeIdioma(d.empresa.idioma_abordagem)}. Sem assinatura.`,
  };
}

export function validarFollowUps(bruto: unknown, numeros: Set<string>, dias: number[], remetente: string): FollowUp[] {
  const lista = (bruto as { followups?: unknown[] })?.followups;
  if (!Array.isArray(lista) || lista.length === 0) throw new SaidaInvalida("nenhum follow-up.");
  const extras = dias.join(" ");
  return dias.map((dia, i) => {
    const f = (lista.find((x) => Number((x as { dia?: unknown }).dia) === dia) ?? lista[i]) as Record<string, unknown> | undefined;
    if (!f) throw new SaidaInvalida(`faltou o follow-up do dia ${dia}.`);
    const assunto = validarTexto(String(f.assunto ?? ""), { numeros, campo: `assunto dia ${dia}`, minimo: 3, maximo: 100, extrasPermitidos: extras });
    if (/[\r\n]/.test(assunto)) throw new SaidaInvalida("assunto com quebra de linha.");
    return {
      dia,
      assunto,
      corpo: validarTexto(String(f.corpo ?? ""), { numeros, campo: `follow-up dia ${dia}`, minimo: 20, maximo: 800, remetente, extrasPermitidos: extras }),
    };
  });
}

export async function gerarFollowUps(
  d: DadosLead,
  r: Remetente,
  primeira: { assunto: string | null; corpo: string },
  dias: number[],
): Promise<FollowUp[]> {
  const { instrucao, numeros } = instrucaoFollowUp(d, r, primeira, dias);
  return gerarConferido(instrucao, ESQUEMA, (b) => validarFollowUps(b, numeros, dias, r.nome));
}
