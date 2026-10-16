import {
  BookOpen,
  Crown,
  Gem,
  CreditCard,
  Globe,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Radar,
  Settings,
  SquareKanban,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * O trilho de navegação segue o trabalho: encontrar (Radar, Leads) →
 * negociar (CRM) → entregar (Clientes, Sites) → receber (Vendas) — e as
 * ferramentas (Campanhas de e-mail, Prompts). `tambem` diz quais rotas
 * acendem cada item (abas e subpáginas).
 */

import type { Recurso } from "@/lib/planos";

export type ChaveContador = "leads" | "oportunidades" | "campanhas" | "emails" | "crm" | "pagamentos" | "notificacoes" | "clientes";

export type ItemNav = {
  href: string;
  rotulo: string;
  /** Nome curto para o trilho (cabe embaixo do ícone). */
  curto: string;
  icone: LucideIcon;
  contador?: ChaveContador;
  tambem?: string[];
  /** Recurso de plano que a tela exige (sem ele, o item aparece com cadeado). */
  recurso?: Recurso;
  /** Só aparece para o dono do SaaS. */
  soDono?: boolean;
  /** Só aparece para assinantes (o dono não assina nada). */
  soAssinante?: boolean;
};

export const GRUPOS_NAV: Array<{ titulo: string; itens: ItemNav[] }> = [
  {
    titulo: "Prospecção",
    itens: [
      { href: "/", rotulo: "Início", curto: "Início", icone: LayoutDashboard, tambem: ["/ao-vivo"] },
      { href: "/buscar", rotulo: "Radar de empresas", curto: "Radar", icone: Radar },
      { href: "/leads", rotulo: "Leads", curto: "Leads", icone: Users, contador: "leads", tambem: ["/mapa", "/oportunidades", "/abordar"] },
      { href: "/crm", rotulo: "CRM", curto: "CRM", icone: SquareKanban, contador: "crm" },
    ],
  },
  {
    titulo: "Entrega",
    itens: [
      { href: "/clientes", rotulo: "Clientes", curto: "Clientes", icone: Handshake, recurso: "clientes" },
      { href: "/sites", rotulo: "Sites", curto: "Sites", icone: Globe, recurso: "sites" },
      { href: "/pagamentos", rotulo: "Vendas", curto: "Vendas", icone: CreditCard, contador: "pagamentos", tambem: ["/analytics"], recurso: "vendas" },
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      { href: "/campanhas", rotulo: "Campanhas de e-mail", curto: "E-mail", icone: Megaphone, contador: "campanhas", tambem: ["/emails", "/mensagens"], recurso: "campanhas" },
      { href: "/prompts", rotulo: "Gerador de prompts", curto: "Prompts", icone: WandSparkles, recurso: "prompts" },
      { href: "/tutoriais", rotulo: "Tutoriais", curto: "Ajuda", icone: BookOpen },
    ],
  },
];

export const NAV_RODAPE: ItemNav[] = [
  { href: "/admin", rotulo: "Painel de membros", curto: "Admin", icone: Crown, soDono: true },
  { href: "/assinatura", rotulo: "Assinatura", curto: "Plano", icone: Gem, soAssinante: true },
  { href: "/configuracoes", rotulo: "Configurações", curto: "Ajustes", icone: Settings },
];

/** Itens visíveis para a conta: tira os do dono/assinante conforme o caso. */
export function visivel(item: ItemNav, ehDono: boolean): boolean {
  if (item.soDono && !ehDono) return false;
  if (item.soAssinante && ehDono) return false;
  return true;
}

function sob(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ativo(pathname: string, item: Pick<ItemNav, "href" | "tambem">): boolean {
  if (item.href === "/") return pathname === "/" || (item.tambem ?? []).some((h) => sob(pathname, h));
  return sob(pathname, item.href) || (item.tambem ?? []).some((h) => sob(pathname, h));
}

export const TODOS_ITENS: ItemNav[] = [...GRUPOS_NAV.flatMap((g) => g.itens), ...NAV_RODAPE];
