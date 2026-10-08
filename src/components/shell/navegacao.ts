import {
  ChartColumn,
  CreditCard,
  Flame,
  LayoutDashboard,
  Mail,
  Map,
  Megaphone,
  Search,
  Send,
  Settings,
  Sparkles,
  SquareKanban,
  Users,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type ChaveContador = "leads" | "oportunidades" | "campanhas" | "emails" | "crm" | "pagamentos" | "notificacoes";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; contador?: ChaveContador };

export const GRUPOS_NAV: Array<{ titulo: string; itens: ItemNav[] }> = [
  {
    titulo: "Principal",
    itens: [
      { href: "/", rotulo: "Dashboard", icone: LayoutDashboard },
      { href: "/buscar", rotulo: "Buscar leads", icone: Search },
      { href: "/oportunidades", rotulo: "Oportunidades", icone: Flame, contador: "oportunidades" },
    ],
  },
  {
    titulo: "Prospecção",
    itens: [
      { href: "/leads", rotulo: "Leads", icone: Users, contador: "leads" },
      { href: "/mapa", rotulo: "Mapa", icone: Map },
      { href: "/crm", rotulo: "CRM", icone: SquareKanban, contador: "crm" },
    ],
  },
  {
    titulo: "Abordagem",
    itens: [
      { href: "/abordar", rotulo: "Abordar", icone: Send },
      { href: "/campanhas", rotulo: "Campanhas", icone: Megaphone, contador: "campanhas" },
      { href: "/mensagens", rotulo: "Mensagens IA", icone: Sparkles },
      { href: "/emails", rotulo: "E-mails", icone: Mail, contador: "emails" },
    ],
  },
  {
    titulo: "Receita",
    itens: [
      { href: "/pagamentos", rotulo: "Pagamentos", icone: CreditCard, contador: "pagamentos" },
      { href: "/analytics", rotulo: "Analytics", icone: ChartColumn },
    ],
  },
];

export const NAV_RODAPE: ItemNav[] = [
  { href: "/notificacoes", rotulo: "Notificações", icone: Bell, contador: "notificacoes" },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

export function ativo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const TODOS_ITENS: ItemNav[] = [...GRUPOS_NAV.flatMap((g) => g.itens), ...NAV_RODAPE];
