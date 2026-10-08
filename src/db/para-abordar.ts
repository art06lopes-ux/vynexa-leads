/**
 * "Para abordar": ainda não contatado, não bloqueado, no começo do funil
 * e com algum canal (WhatsApp ou e-mail). Uma definição só, usada pela
 * aba de Leads, pelo número no menu e pela lista de envio do WhatsApp —
 * para os três sempre contarem as mesmas empresas.
 * Pressupõe os apelidos `l` (leads) e `e` (empresas).
 */
export const CONDICAO_PARA_ABORDAR = `(l.contatado_em IS NULL AND e.nao_contatar = 0 AND l.etapa IN ('novo', 'qualificado')
  AND (e.whatsapp = 1 OR (e.email IS NOT NULL AND e.email <> '')))`;
