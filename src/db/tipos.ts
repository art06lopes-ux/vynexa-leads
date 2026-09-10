export type StatusBusca = "pendente" | "em_andamento" | "concluida" | "erro";
export type StatusJob = "pendente" | "em_andamento" | "concluido" | "erro";
export type TipoJob = "busca" | "analise_ia" | "envio_email";
export type StatusSite = "sem_site" | "rede_social" | "tem_site" | "sem_dado";
export type StatusLead = "novo" | "contatado" | "respondeu" | "fechado" | "nao_interessado";
export type Canal = "whatsapp" | "email";

export type Busca = {
  id: string;
  segmento: string;
  pais: string;
  estado: string | null;
  cidade: string | null;
  rotulo_resolvido: string | null;
  raio_final_km: number | null;
  expansoes: number;
  status: StatusBusca;
  quantidade_encontrada: number;
  quantidade_nova: number;
  erro: string | null;
  criado_em: string;
  concluido_em: string | null;
};

export type Empresa = {
  id: string;
  busca_id: string | null;
  osm_id: string;
  nome: string;
  pais: string;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  telefone: string | null;
  telefone_manual: number;
  email: string | null;
  email_origem: "osm" | "site" | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  categoria: string;
  avaliacao_nota: number | null;
  avaliacao_qtd: number | null;
  idioma_abordagem: string;
  status_site: StatusSite;
  criado_em: string;
  atualizado_em: string;
};

export type Job = {
  id: string;
  tipo: TipoJob;
  payload: string;
  status: StatusJob;
  tentativas: number;
  lease_ate: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** Payload de um job do tipo `busca`. */
export type PayloadBusca = {
  buscaId: string;
  /** Meta de resultados; o worker expande o raio até chegar perto disto. */
  alvo: number;
};

export type Contadores = {
  total: number;
  semSite: number;
  comEmail: number;
  comWhatsapp: number;
  oportunidadeAlta: number;
};

export const ROTULO_STATUS_SITE: Record<StatusSite, string> = {
  sem_site: "Sem site",
  rede_social: "Só rede social",
  tem_site: "Tem site",
  sem_dado: "Sem dados",
};
