import {
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

export type ChaveContador = "leads" | "oportunidades" | "campanhas" | "emails" | "crm" | "pagamentos" | "notificacoes" | "clientes";

export type ItemNav = {
  href: string;
  rotulo: string;
  /** Nome curto para o trilho (cabe embaixo do ícone). */
  curto: string;
  icone: LucideIcon;
  contador?: ChaveContador;
  tambem?: string[];
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
      { href: "/clientes", rotulo: "Clientes", curto: "Clientes", icone: Handshake },
      { href: "/sites", rotulo: "Sites", curto: "Sites", icone: Globe },
      { href: "/pagamentos", rotulo: "Vendas", curto: "Vendas", icone: CreditCard, contador: "pagamentos", tambem: ["/analytics"] },
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      { href: "/campanhas", rotulo: "Campanhas de e-mail", curto: "E-mail", icone: Megaphone, contador: "campanhas", tambem: ["/emails", "/mensagens"] },
      { href: "/prompts", rotulo: "Gerador de prompts", curto: "Prompts", icone: WandSparkles },
    ],
  },
];

export const NAV_RODAPE: ItemNav[] = [{ href: "/configuracoes", rotulo: "Configurações", curto: "Ajustes", icone: Settings }];

function sob(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ativo(pathname: string, item: Pick<ItemNav, "href" | "tambem">): boolean {
  if (item.href === "/") return pathname === "/" || (item.tambem ?? []).some((h) => sob(pathname, h));
  return sob(pathname, item.href) || (item.tambem ?? []).some((h) => sob(pathname, h));
}

export const TODOS_ITENS: ItemNav[] = [...GRUPOS_NAV.flatMap((g) => g.itens), ...NAV_RODAPE];
