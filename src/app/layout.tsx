import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Monoespaçada só para telefone e contadores. Um número de telefone em
 * fonte proporcional é mais difícil de conferir de relance, e conferir
 * telefone é metade do trabalho nesta ferramenta.
 */
const mono = JetBrains_Mono({
  variable: "--font-mono-numeros",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Vynexa Leads", template: "%s · Vynexa Leads" },
  description: "Prospecção de empresas locais sem site, a partir do OpenStreetMap.",
  // Ferramenta interna: não existe motivo para aparecer em buscador.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f0f10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${mono.variable} h-full dark`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
