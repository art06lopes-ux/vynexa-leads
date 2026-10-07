import type { FonteEmpresa } from "@/db/tipos";

/**
 * Contrato de uma fonte de empresas.
 *
 * Cada provedor (Google Places, OpenStreetMap, planilha CSV, cadastro
 * manual) devolve `LugarEncontrado` — o mesmo formato, com `fonte` e
 * `fonteUrl` dizendo de onde veio. Daí em diante tudo é igual: dedup,
 * score, registro (`src/services/registro.ts`). Trocar ou acrescentar uma
 * fonte não mexe em nada depois dela.
 */

export type LugarEncontrado = {
  fonte: FonteEmpresa;
  /** Id do registro na fonte (place_id, "node/123", CNPJ). Nulo em CSV/manual. */
  externoId: string | null;
  /** Endereço público do registro na fonte, para conferência. */
  fonteUrl: string | null;
  nome: string;
  /** Termo pesquisado ou slug do segmento. */
  categoria: string;
  /** Como a fonte nomeia a categoria ("Barber shop"). */
  categoriaRotulo: string | null;
  pais: string;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  cep: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  avaliacaoNota: number | null;
  avaliacaoQtd: number | null;
  statusNegocio: string | null;
};

export type Retangulo = { sul: number; oeste: number; norte: number; leste: number };

export type ConsultaBusca = {
  termo: string;
  /** Código ISO do país, quando conhecido. */
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  cep: string | null;
  /** Texto livre de localização ("Manacapuru, Amazonas"), quando não há campos. */
  local: string | null;
  centro: { lat: number; lng: number } | null;
  raioKm: number | null;
  /** Área desenhada no mapa. Tem precedência sobre o resto. */
  retangulo: Retangulo | null;
  /** Idioma dos resultados (nomes de categoria, endereço). */
  idioma: string;
  /** Teto de requisições pagas nesta busca (controle de custo). */
  maxRequisicoes: number;
  /**
   * Pesquisa colada de um link do Google Maps: o texto vai como está, e
   * o centro do mapa vira preferência de lugar (não restrição) — é o que
   * o próprio Maps faz, e o resultado fica igual ao que o operador viu.
   */
  linkMaps?: { consulta: string; centro: { lat: number; lng: number } | null; raioKm: number | null } | null;
};

export type ResultadoProvedor = {
  lugares: LugarEncontrado[];
  requisicoes: number;
  /** Área efetivamente coberta (para o mapa e o histórico). */
  area: Retangulo | null;
  rotulo: string | null;
  /** Observação para o operador ("a área tem mais resultados do que o teto permitiu"). */
  aviso: string | null;
};

export type Progresso = (etapa: string) => Promise<void> | void;

export interface LeadProvider {
  readonly fonte: FonteEmpresa;
  readonly rotulo: string;
  /** Pronto para uso (chave configurada, serviço acessível)? Não faz chamada paga. */
  disponivel(): Promise<boolean>;
  buscar(consulta: ConsultaBusca, progresso?: Progresso): Promise<ResultadoProvedor>;
}

export class ErroProvedor extends Error {
  constructor(
    mensagem: string,
    readonly temporario = false,
    readonly semConfiguracao = false,
  ) {
    super(mensagem);
  }
}
