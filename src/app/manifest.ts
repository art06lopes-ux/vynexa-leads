import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA.
 *
 * É o que permite "Adicionar à tela inicial" instalar o site como
 * aplicativo — e, no iPhone, é a única forma de receber push: o Safari
 * só entrega notificação a site instalado, nunca à aba do navegador.
 *
 * `display: standalone` esconde a barra do navegador; `start_url` com
 * `?fonte=pwa` permite distinguir nas métricas quem abriu pelo ícone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vynexa Leads",
    short_name: "Vynexa",
    description: "Prospecção e vendas da Vynexa Dev.",
    start_url: "/?fonte=pwa",
    display: "standalone",
    background_color: "#0c0a0a",
    theme_color: "#0c0a0a",
    lang: "pt-BR",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      // "maskable": o Android recorta o ícone em círculo ou na forma do
      // fabricante; esta variante tem margem para o "V" não sair cortado.
      {
        src: "/icones/icone-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icones/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
