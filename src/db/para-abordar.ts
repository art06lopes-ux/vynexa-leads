/**
 * Definições de "situação" usadas em vários lugares — o filtro de Leads,
 * o número no menu, o Início e a lista de envio do WhatsApp — para todos
 * contarem as mesmas empresas. Pressupõem os apelidos `l` (leads) e
 * `e` (empresas).
 */

/** Ainda não abordado: sem contato registrado, não bloqueado, no começo do funil. */
export const CONDICAO_NAO_ABORDADO = `(l.contatado_em IS NULL AND e.nao_contatar = 0 AND l.etapa IN ('novo', 'qualificado'))`;

/** Não abordado E com um canal para abordar agora (WhatsApp ou e-mail). */
export const CONDICAO_PARA_ABORDAR = `(${CONDICAO_NAO_ABORDADO} AND (e.whatsapp = 1 OR (e.email IS NOT NULL AND e.email <> '')))`;

export const SITUACOES = ["nao_abordados", "abordados", "responderam", "nao_contatar"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  nao_abordados: "Não abordados",
  abordados: "Já abordados",
  responderam: "Responderam",
  nao_contatar: "Não contatar",
};

export const CONDICAO_SITUACAO: Record<Situacao, string> = {
  nao_abordados: CONDICAO_NAO_ABORDADO,
  abordados: "(l.contatado_em IS NOT NULL OR l.etapa IN ('abordado', 'respondeu', 'negociacao', 'proposta', 'fechado'))",
  responderam: "(l.respondeu_em IS NOT NULL OR l.etapa IN ('respondeu', 'negociacao', 'proposta', 'fechado'))",
  nao_contatar: "(e.nao_contatar = 1)",
};
