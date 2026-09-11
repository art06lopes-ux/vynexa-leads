/**
 * Gera os ícones do PWA a partir da marca em SVG.
 *
 * Rasteriza com resvg em WebAssembly — sem binário nativo, o que importa
 * nesta máquina, onde o Windows bloqueia `.node` sem assinatura. Roda uma
 * vez; os PNGs entram no repositório.
 *
 *   npx tsx scripts/gerar-icones.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { initWasm, Resvg } from "@resvg/resvg-wasm";

const MARCA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#g)"/>
  <path d="M9 10.5 L16 22 L23 10.5" fill="none" stroke="#0c0a0a" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Versão "maskable": o Android recorta o ícone num círculo ou numa forma
 * do fabricante, então a marca precisa de margem — a zona segura é o
 * círculo central com 80% do lado. Sem esta variante o "V" sairia cortado.
 */
const MARCA_MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="url(#g)"/>
  <path d="M13 14.5 L20 26 L27 14.5" fill="none" stroke="#0c0a0a" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const TAMANHOS = [192, 512];

async function rasterizar(svg: string, tamanho: number): Promise<Uint8Array> {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: tamanho } });
  return r.render().asPng();
}

async function main() {
  const wasm = await readFile(join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"));
  await initWasm(wasm);

  const pasta = join(process.cwd(), "public", "icones");
  await mkdir(pasta, { recursive: true });

  for (const t of TAMANHOS) {
    await writeFile(join(pasta, `icone-${t}.png`), await rasterizar(MARCA, t));
    await writeFile(join(pasta, `icone-maskable-${t}.png`), await rasterizar(MARCA_MASKABLE, t));
    console.log(`  icone-${t}.png e icone-maskable-${t}.png`);
  }

  // Ícone da notificação: menor, sem gradiente — o Android o desenha
  // monocromático na barra de status.
  await writeFile(join(pasta, "notificacao-96.png"), await rasterizar(MARCA, 96));
  console.log("  notificacao-96.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
