/** Constantes da carteira e dos projetos — sem banco, seguras para o navegador. */

export const ESTAGIOS_CARTEIRA = ["respondeu", "negociacao", "proposta", "fechado"] as const;
export type EstagioCarteira = (typeof ESTAGIOS_CARTEIRA)[number];

export const ROTULO_ESTAGIO: Record<EstagioCarteira, string> = {
  respondeu: "Lead",
  negociacao: "Negociação",
  proposta: "Proposta enviada",
  fechado: "Cliente",
};

export const TIPOS_PROJETO = ["site", "landing", "sistema", "loja", "app", "outro"] as const;
export type TipoProjeto = (typeof TIPOS_PROJETO)[number];
export const ROTULO_TIPO: Record<TipoProjeto, string> = {
  site: "Site",
  landing: "Landing page",
  sistema: "Sistema",
  loja: "Loja virtual",
  app: "App",
  outro: "Outro",
};

export const STATUS_PROJETO = ["briefing", "desenvolvimento", "revisao", "publicado", "arquivado"] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];
export const ROTULO_STATUS_PROJETO: Record<StatusProjeto, string> = {
  briefing: "Briefing",
  desenvolvimento: "Em desenvolvimento",
  revisao: "Em revisão",
  publicado: "Publicado",
  arquivado: "Arquivado",
};
