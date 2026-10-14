import type { StatusProjeto, TipoProjeto } from "@/lib/projetos";

/**
 * Sites que a Vynexa já tem no ar, para importar com um clique no
 * portfólio vazio. Valor só onde ele é conhecido (GN Celulares); nos
 * outros fica zero e a observação pede para confirmar — nada inventado.
 */
export type SiteInicial = { nome: string; cliente: string; url: string; tipo: TipoProjeto; status: StatusProjeto; valor?: string; observacoes: string };

const PREVIA = "Prévia publicada. Confirme se o cliente fechou e preencha o valor.";

export const PORTFOLIO_INICIAL: SiteInicial[] = [
  { nome: "GN Celulares", cliente: "GN Celulares", url: "https://gn-celulares.vercel.app", tipo: "loja", status: "publicado", valor: "1500", observacoes: "Site + painel administrativo (Supabase). Cliente fechado." },
  { nome: "Confraria da Barba", cliente: "Confraria da Barba", url: "https://confraria-da-barba.vercel.app", tipo: "sistema", status: "publicado", observacoes: "ERP de barbearia. Combinar sessão de treinamento com o cliente." },
  { nome: "Balneário Quero Mais", cliente: "Balneário Quero Mais", url: "https://balneario-quero-mais.vercel.app", tipo: "site", status: "publicado", observacoes: "Em produção na Vercel." },
  { nome: "DJ Social Media", cliente: "DJ Social Media", url: "https://dj-social-media.vercel.app", tipo: "site", status: "publicado", observacoes: "Site oficial aprovado pelo cliente." },
  { nome: "Airon Store", cliente: "Airon Store", url: "https://airon-store.vercel.app", tipo: "loja", status: "publicado", observacoes: PREVIA },
  { nome: "AUSIH Salão", cliente: "AUSIH", url: "https://ausih-salao.vercel.app", tipo: "site", status: "publicado", observacoes: `${PREVIA} Há também a versão simples em ausih-salao-simples.vercel.app.` },
  { nome: "Brasil Fitness", cliente: "Brasil Fitness", url: "https://brasil-fitness.vercel.app", tipo: "site", status: "publicado", observacoes: PREVIA },
  { nome: "FisioFitness", cliente: "FisioFitness", url: "https://fisiofitness.vercel.app", tipo: "site", status: "publicado", observacoes: PREVIA },
  { nome: "Sergio Marques — autorização de venda", cliente: "Sergio Marques", url: "https://sergio-marques.vercel.app", tipo: "sistema", status: "publicado", observacoes: PREVIA },
  { nome: "Recanto do Guerreiro — delivery", cliente: "Recanto do Guerreiro", url: "https://recanto-do-guerreiro.vercel.app", tipo: "loja", status: "publicado", observacoes: PREVIA },
  { nome: "Espetinho de Garagem — delivery", cliente: "Espetinho de Garagem", url: "https://espetinho-de-garagem.vercel.app", tipo: "loja", status: "publicado", observacoes: PREVIA },
  { nome: "NoForno — confeitaria", cliente: "NoForno", url: "https://noforno.vercel.app", tipo: "loja", status: "publicado", observacoes: PREVIA },
  { nome: "MOVYA", cliente: "Vynexa (produto próprio)", url: "https://movya-mu.vercel.app", tipo: "app", status: "publicado", observacoes: "App esportivo próprio para Manacapuru." },
];
