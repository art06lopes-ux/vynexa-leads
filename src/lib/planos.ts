/**
 * Planos do SaaS. Os valores daqui são o ponto de partida: preço e
 * limites ficam na tabela `planos` do banco principal e o dono muda pelo
 * painel de admin. O que NÃO muda no painel é quais recursos cada plano
 * libera — isso é produto, e mudar exige código (e aviso aos clientes).
 *
 * Arquivo sem dependência de servidor: a landing page e o cliente usam.
 */

export type IdPlano = "essencial" | "pro" | "agencia" | "dono";

export type Recurso =
  | "radar_google" // busca no Google Places (com a chave do próprio cliente)
  | "ia" // mensagens e análise de site com IA
  | "ao_vivo"
  | "campanhas" // campanhas de e-mail
  | "prompts"
  | "clientes"
  | "sites"
  | "vendas"
  | "exportar"
  | "receita" // base da Receita Federal (só o dono)
  | "admin";

export type Limites = {
  /** Leads novos por mês. `null` = sem limite. */
  leads_mes: number | null;
  /** Pessoas com login na conta. */
  usuarios: number | null;
  /** Análises/mensagens de IA por mês com a chave da Vynexa (sem limite com chave própria). */
  ia_mes: number | null;
};

export type Plano = {
  id: IdPlano;
  nome: string;
  descricao: string;
  precoCentavos: number;
  destaque: boolean;
  limites: Limites;
};

export const RECURSOS_DO_PLANO: Record<IdPlano, Recurso[]> = {
  essencial: [],
  pro: ["radar_google", "ia", "ao_vivo", "campanhas", "prompts"],
  agencia: ["radar_google", "ia", "ao_vivo", "campanhas", "prompts", "clientes", "sites", "vendas", "exportar"],
  dono: ["radar_google", "ia", "ao_vivo", "campanhas", "prompts", "clientes", "sites", "vendas", "exportar", "receita", "admin"],
};

export const PLANOS_PADRAO: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    descricao: "Para começar a prospectar todo dia.",
    precoCentavos: 2990,
    destaque: false,
    limites: { leads_mes: 1000, usuarios: 1, ia_mes: 0 },
  },
  {
    id: "pro",
    nome: "PRO",
    descricao: "Google, IA e campanhas: o kit completo de quem vende site.",
    precoCentavos: 5990,
    destaque: true,
    limites: { leads_mes: 5000, usuarios: 2, ia_mes: 300 },
  },
  {
    id: "agencia",
    nome: "Agência",
    descricao: "Para quem tem equipe e quer o fluxo inteiro: da busca à venda.",
    precoCentavos: 11990,
    destaque: false,
    limites: { leads_mes: 15000, usuarios: 5, ia_mes: 1000 },
  },
];

export const PLANO_DONO: Plano = {
  id: "dono",
  nome: "Dono",
  descricao: "Acesso total.",
  precoCentavos: 0,
  destaque: false,
  limites: { leads_mes: null, usuarios: null, ia_mes: null },
};

export function temRecurso(plano: IdPlano | string, recurso: Recurso): boolean {
  return (RECURSOS_DO_PLANO[plano as IdPlano] ?? []).includes(recurso);
}

/** O plano mais barato que libera o recurso — para o "disponível no PRO". */
export function planoQueLibera(recurso: Recurso): "pro" | "agencia" | null {
  if (RECURSOS_DO_PLANO.pro.includes(recurso)) return "pro";
  if (RECURSOS_DO_PLANO.agencia.includes(recurso)) return "agencia";
  return null;
}

/** Linhas da tabela de comparação (landing e tela de assinatura). */
export const COMPARATIVO: Array<{ rotulo: string; valor: (p: Plano) => string | boolean }> = [
  { rotulo: "Leads novos por mês", valor: (p) => (p.limites.leads_mes === null ? "Ilimitado" : p.limites.leads_mes.toLocaleString("pt-BR")) },
  { rotulo: "Radar no mapa (OpenStreetMap)", valor: () => true },
  { rotulo: "Score e qualificação de leads", valor: () => true },
  { rotulo: "CRM com funil e WhatsApp", valor: () => true },
  { rotulo: "Busca no Google Maps (sua chave)", valor: (p) => temRecurso(p.id, "radar_google") },
  { rotulo: "Mensagens e análise de site com IA", valor: (p) => (temRecurso(p.id, "ia") ? `${p.limites.ia_mes ?? "∞"}/mês` : false) },
  { rotulo: "Campanhas de e-mail", valor: (p) => temRecurso(p.id, "campanhas") },
  { rotulo: "Sala ao vivo e gerador de prompts", valor: (p) => temRecurso(p.id, "ao_vivo") },
  { rotulo: "Clientes, portfólio e vendas", valor: (p) => temRecurso(p.id, "vendas") },
  { rotulo: "Exportar planilha", valor: (p) => temRecurso(p.id, "exportar") },
  { rotulo: "Pessoas na conta", valor: (p) => String(p.limites.usuarios ?? "∞") },
];

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Qual recurso cada rota do painel exige (rotas fora daqui são de todos). */
export const RECURSO_DA_ROTA: Array<{ prefixo: string; recurso: Recurso }> = [
  { prefixo: "/ao-vivo", recurso: "ao_vivo" },
  { prefixo: "/campanhas", recurso: "campanhas" },
  { prefixo: "/emails", recurso: "campanhas" },
  { prefixo: "/prompts", recurso: "prompts" },
  { prefixo: "/clientes", recurso: "clientes" },
  { prefixo: "/sites", recurso: "sites" },
  { prefixo: "/pagamentos", recurso: "vendas" },
  { prefixo: "/analytics", recurso: "vendas" },
  { prefixo: "/admin", recurso: "admin" },
];
