import type { Metadata } from "next";

import { Landing } from "@/components/landing/landing";
import { lerConfigSaas } from "@/services/admin";
import { diasDeTeste, listarPlanos } from "@/services/contas";

/** Preços e dias de teste vêm do banco: a página se refaz a cada 5 min (e na hora quando o admin salva um plano). */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Vynexa Leads — ache quem precisa de um site na sua cidade" },
  description: "Mapeie as empresas da sua cidade, veja quem não tem site (ou só tem Instagram, iFood ou agenda de app) e aborde pelo WhatsApp com a mensagem pronta. Teste grátis.",
  // A página de vendas é pública e deve aparecer no Google; o resto do app não.
  robots: { index: true, follow: true },
  openGraph: {
    title: "Vynexa Leads",
    description: "Ache quem precisa de um site antes do seu concorrente.",
    type: "website",
    locale: "pt_BR",
  },
};

export default async function PaginaConheca() {
  const [planos, dias, config] = await Promise.all([
    listarPlanos(),
    diasDeTeste().catch(() => 7),
    lerConfigSaas().catch(() => ({ testeDias: 7, whatsappSuporte: "" })),
  ]);
  return <Landing planos={planos} diasTeste={dias} whatsapp={config.whatsappSuporte || null} />;
}
