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

/** Quando foi o último contato feito (WhatsApp aberto, e-mail enviado, contato registrado). */
export const ULTIMO_CONTATO = `COALESCE((SELECT MAX(ev.criado_em) FROM eventos ev WHERE ev.lead_id = l.id
  AND ev.tipo IN ('whatsapp_aberto', 'email_enviado', 'contato_registrado')), l.contatado_em)`;

/**
 * Para retomar: abordado, sem resposta, e o ÚLTIMO contato foi há 3 dias
 * ou mais — retomar ontem tira a empresa da lista até passarem mais 3.
 */
export const CONDICAO_RETOMAR = `(l.etapa = 'abordado' AND l.respondeu_em IS NULL AND e.nao_contatar = 0
  AND ${ULTIMO_CONTATO} <= datetime('now', '-3 days'))`;

export const SITUACOES = ["nao_abordados", "retomar", "abordados", "responderam", "nao_contatar"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  nao_abordados: "Não abordados",
  retomar: "Para retomar",
  abordados: "Já abordados",
  responderam: "Responderam",
  nao_contatar: "Não contatar",
};

export const CONDICAO_SITUACAO: Record<Situacao, string> = {
  nao_abordados: CONDICAO_NAO_ABORDADO,
  retomar: CONDICAO_RETOMAR,
  abordados: "(l.contatado_em IS NOT NULL OR l.etapa IN ('abordado', 'respondeu', 'negociacao', 'proposta', 'fechado'))",
  responderam: "(l.respondeu_em IS NOT NULL OR l.etapa IN ('respondeu', 'negociacao', 'proposta', 'fechado'))",
  nao_contatar: "(e.nao_contatar = 1)",
};
