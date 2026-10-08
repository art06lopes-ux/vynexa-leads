import { CreditCard, LayoutDashboard, Megaphone, Search, Settings, SquareKanban, Users, type LucideIcon } from "lucide-react";

/**
 * O menu segue o trabalho do dia, na ordem: buscar empresas → escolher e
 * abordar (Leads) → acompanhar os envios (Campanhas) → negociar (CRM) →
 * receber (Vendas). Telas que eram variações umas das outras viraram
 * abas dentro do item certo — `tambem` diz quais rotas acendem cada um.
 */

export type ChaveContador = "leads" | "oportunidades" | "campanhas" | "emails" | "crm" | "pagamentos" | "notificacoes";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; contador?: ChaveContador; tambem?: string[] };

export const GRUPOS_NAV: Array<{ titulo: string; itens: ItemNav[] }> = [
  {
    titulo: "Prospecção",
    itens: [
      { href: "/", rotulo: "Início", icone: LayoutDashboard },
      { href: "/buscar", rotulo: "Buscar empresas", icone: Search },
      { href: "/leads", rotulo: "Leads", icone: Users, contador: "leads", tambem: ["/mapa", "/oportunidades", "/abordar"] },
      { href: "/campanhas", rotulo: "Campanhas", icone: Megaphone, contador: "campanhas", tambem: ["/emails", "/mensagens"] },
    ],
  },
  {
    titulo: "Vendas",
    itens: [
      { href: "/crm", rotulo: "CRM", icone: SquareKanban, contador: "crm" },
      { href: "/pagamentos", rotulo: "Vendas", icone: CreditCard, contador: "pagamentos", tambem: ["/analytics"] },
    ],
  },
];

export const NAV_RODAPE: ItemNav[] = [{ href: "/configuracoes", rotulo: "Configurações", icone: Settings }];

function sob(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ativo(pathname: string, item: Pick<ItemNav, "href" | "tambem">): boolean {
  if (item.href === "/") return pathname === "/";
  return sob(pathname, item.href) || (item.tambem ?? []).some((h) => sob(pathname, h));
}

export const TODOS_ITENS: ItemNav[] = [...GRUPOS_NAV.flatMap((g) => g.itens), ...NAV_RODAPE];
