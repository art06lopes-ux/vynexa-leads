/**
 * Tipos do banco.
 *
 * Desde a v2 (migração 0012) os enums que evoluem com o produto não têm
 * CHECK no SQL — o lugar que diz quais valores existem é este arquivo.
 * Toda escrita passa por código que usa estes tipos, e as entradas da
 * interface são validadas com zod antes de chegar ao banco.
 */

export type StatusBusca = "pendente" | "em_andamento" | "concluida" | "erro";
export type StatusJob = "pendente" | "em_andamento" | "concluido" | "erro";
export type TipoJob =
  | "busca"
  | "busca_google"
  | "analise_ia"
  | "enriquecer_email"
  | "avaliar_site"
  | "preparar_campanha"
  | "enviar_campanha"
  // Nomes antigos, ainda presentes em jobs gravados antes da v2.
  | "gerar_emails"
  | "envio_email";

/** O que a fonte declara sobre presença na web. */
export type StatusSite = "sem_site" | "rede_social" | "tem_site" | "sem_dado";

/** O que a visita ao site mediu. Nulo enquanto ninguém visitou. */
export type QualidadeSite = "excelente" | "bom" | "fraco" | "fora_do_ar";

/**
 * O status que a interface mostra, juntando os dois acima: quem tem site
 * ganha a nota da visita; quem não tem, a presença declarada.
 */
export type StatusPresenca =
  | "excelente"
  | "bom"
  | "fraco"
  | "fora_do_ar"
  | "sem_site"
  | "rede_social"
  | "nao_avaliado"
  | "sem_dado";

export type EtapaLead =
  | "novo"
  | "qualificado"
  | "abordado"
  | "respondeu"
  | "negociacao"
  | "proposta"
  | "fechado"
  | "perdido";

/** Nome antigo, mantido para os módulos que ainda o importam. */
export type StatusLead = EtapaLead;

export type Prioridade = "alta" | "media" | "baixa";
export type Canal = "whatsapp" | "email";
export type FonteEmpresa = "google_places" | "osm" | "receita" | "csv" | "manual";
export type OrigemContato = "osm" | "receita" | "manual" | "google_places" | "site" | "csv";
export type OrigemTelefone = OrigemContato;
export type OrigemEmail = OrigemContato;

export type Busca = {
  id: string;
  segmento: string;
  pais: string;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  cep: string | null;
  provedor: string;
  consulta_natural: string | null;
  rotulo_resolvido: string | null;
  raio_km: number | null;
  raio_final_km: number | null;
  centro_lat: number | null;
  centro_lng: number | null;
  filtros: string | null;
  resumo: string | null;
  expansoes: number;
  status: StatusBusca;
  etapa_atual: string | null;
  quantidade_encontrada: number;
  quantidade_nova: number;
  quantidade_receita: number;
  quantidade_duplicada: number;
  requisicoes: number;
  erro: string | null;
  criado_em: string;
  concluido_em: string | null;
};

export type Empresa = {
  id: string;
  busca_id: string | null;
  fonte: FonteEmpresa;
  fonte_url: string | null;
  place_id: string | null;
  osm_id: string | null;
  cnpj: string | null;
  nome: string;
  nome_chave: string | null;
  pais: string;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  cep: string | null;
  endereco: string | null;
  endereco_chave: string | null;
  latitude: number | null;
  longitude: number | null;
  telefone: string | null;
  telefone_e164: string | null;
  telefone_origem: OrigemContato | null;
  telefone_manual: number;
  whatsapp: number | null;
  email: string | null;
  email_origem: OrigemContato | null;
  website: string | null;
  dominio: string | null;
  instagram: string | null;
  facebook: string | null;
  categoria: string;
  categoria_rotulo: string | null;
  cnae: string | null;
  fundada_em: string | null;
  avaliacao_nota: number | null;
  avaliacao_qtd: number | null;
  status_negocio: string | null;
  idioma_abordagem: string;
  status_site: StatusSite;
  site_qualidade: QualidadeSite | null;
  site_sinais: string | null;
  site_tempo_ms: number | null;
  site_avaliado_em: string | null;
  nao_contatar: number;
  nao_contatar_motivo: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type MotivoScore = { pontos: number; motivo: string };

export type Lead = {
  id: string;
  empresa_id: string;
  score_oportunidade: number | null;
  score_motivos: string | null;
  score_calculado_em: string | null;
  prioridade: Prioridade | null;
  etapa: EtapaLead;
  etapa_em: string | null;
  motivo_perda: string | null;
  motivo_problema: string | null;
  mensagem_gerada: string | null;
  canal_recomendado: Canal | null;
  analise: string | null;
  solucao_sugerida: string | null;
  produto_sugerido_id: string | null;
  observacao: string | null;
  contatado_em: string | null;
  respondeu_em: string | null;
  analisado_em: string | null;
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

/** Payload de um job do tipo `busca` (OpenStreetMap + Receita). */
export type PayloadBusca = {
  buscaId: string;
  /** Meta de resultados; o worker expande o raio até chegar perto disto. */
  alvo: number;
  somenteReceita?: boolean;
  receitaCursor?: string;
  receitaAcumulado?: number;
};

export type StatusEnvio =
  | "pendente"
  | "preparado"
  | "agendado"
  | "enviando"
  | "enviado"
  | "entregue"
  | "aberto"
  | "clicado"
  | "respondeu"
  | "erro"
  | "cancelado";

export type StatusCampanha =
  | "rascunho"
  | "preparando"
  | "pronta"
  | "agendada"
  | "enviando"
  | "pausada"
  | "concluida"
  | "cancelada";

export type TipoEvento =
  | "lead_encontrado"
  | "ia_analisou"
  | "mensagem_gerada"
  | "whatsapp_aberto"
  | "mensagem_copiada"
  | "email_enviado"
  | "email_aberto"
  | "email_clicado"
  | "lead_respondeu"
  | "etapa_alterada"
  | "nota"
  | "contato_registrado"
  | "proposta_gerada"
  | "venda_registrada"
  | "cobranca_criada"
  | "pagamento_confirmado"
  | "adicionado_campanha"
  | "nao_contatar"
  | "site_avaliado";

export type TipoMensagem = "curta" | "profissional" | "informal" | "whatsapp" | "instagram" | "email" | "followup";

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

export const ROTULO_FONTE: Record<FonteEmpresa, string> = {
  google_places: "Google Maps",
  osm: "OpenStreetMap",
  receita: "Receita Federal",
  csv: "Importação CSV",
  manual: "Cadastro manual",
};
