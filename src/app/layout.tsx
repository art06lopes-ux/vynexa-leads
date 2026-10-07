import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Sora } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/**
 * Duas famílias com papéis distintos: Sora (geométrica, de traço firme)
 * para títulos e números grandes — é a cara de "produto de dados" da
 * referência —, Manrope para o texto de interface, que precisa ser
 * legível em 13px numa tabela densa.
 */
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

/** Monoespaçada só para telefone: conferir número é metade do trabalho aqui. */
const mono = JetBrains_Mono({ variable: "--font-mono-numeros", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vynexa Leads", template: "%s · Vynexa Leads" },
  description: "Plataforma de prospecção e vendas da Vynexa Dev.",
  // Ferramenta interna: não existe motivo para aparecer em buscador.
  robots: { index: false, follow: false },
  // Instalado na tela de início do iPhone ("Adicionar à Tela de Início"):
  // abre sem a barra do Safari, com o nome curto, e é o único jeito de a
  // Apple entregar push. O ícone (app/apple-icon.png) é o "V" da Vynexa —
  // é ele que aparece ao lado de cada notificação.
  appleWebApp: { capable: true, title: "Vynexa", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050a18",
  // Sem esta meta o menu nativo de <select> abre branco no Chrome/Windows.
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${manrope.variable} ${mono.variable} h-full dark`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
