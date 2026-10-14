/**
 * Gera as imagens da marca na identidade brasa (v3), a partir do V real
 * do banner da Vynexa: recorta, tira o fundo branco, recolore pela
 * luminância (mantém o sombreado da fita 3D) e monta os ícones do app.
 *
 *   node scripts/gerar-marca-brasa.cjs "C:/Users/art06/Downloads/vynexa banner pagina.png"
 */
const sharp = require("sharp");

const BANNER = process.argv[2] ?? "C:/Users/art06/Downloads/vynexa banner pagina.png";

// sombra profunda -> brasa -> âmbar -> creme
const RAMPA = [[0, [92, 18, 4]], [0.35, [226, 64, 12]], [0.6, [255, 90, 31]], [0.82, [255, 160, 70]], [1, [255, 226, 180]]];
function cor(t) {
  for (let i = 1; i < RAMPA.length; i++) {
    const [t1, c1] = RAMPA[i];
    const [t0, c0] = RAMPA[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return RAMPA[RAMPA.length - 1][1];
}

async function recortarV() {
  const { data, info } = await sharp(BANNER).extract({ left: 790, top: 150, width: 360, height: 250 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    const a = Math.max(0, Math.min(1, (248 - m) / 70));
    if (a <= 0) {
      data[i + 3] = 0;
      continue;
    }
    for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, Math.round((data[i + k] - (1 - a) * 255) / a)));
    data[i + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
}

async function recolorir(v) {
  const { data, info } = await sharp(v).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lum = [];
  let min = 1;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    lum.push(l);
    if (data[i + 3] > 200) {
      min = Math.min(min, l);
      max = Math.max(max, l);
    }
  }
  for (let i = 0, k = 0; i < data.length; i += 4, k++) {
    const t = Math.min(1, Math.max(0, (lum[k] - min) / (max - min || 1)));
    const [r, g, b] = cor(0.15 + t * 0.85);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

const fundo = (t, raio) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}">
  <defs><radialGradient id="g" cx="72%" cy="18%" r="95%"><stop offset="0" stop-color="#3a1a0c"/><stop offset="0.5" stop-color="#17110d"/><stop offset="1" stop-color="#0b0a09"/></radialGradient></defs>
  <rect width="${t}" height="${t}" rx="${raio}" fill="url(#g)"/></svg>`);

async function icone(v, t, escala, raio, saida) {
  const img = await sharp(v).resize({ width: Math.round(t * escala), height: Math.round(t * escala), fit: "inside" }).toBuffer();
  const m = await sharp(img).metadata();
  await sharp(fundo(t, raio))
    .composite([{ input: img, left: Math.round((t - m.width) / 2), top: Math.round((t - m.height) / 2 + t * 0.02) }])
    .png()
    .toFile(saida);
}

(async () => {
  const v = await recolorir(await recortarV());
  await sharp(v).resize({ width: 512 }).toFile("public/marca/v-brasa.png");
  await sharp(v).resize({ width: 96 }).toFile("public/marca/v-brasa-96.png");
  await icone(v, 180, 0.62, 0, "src/app/apple-icon.png");
  await icone(v, 64, 0.74, 14, "src/app/icon.png");
  await icone(v, 192, 0.6, 42, "public/icones/icone-192.png");
  await icone(v, 512, 0.6, 112, "public/icones/icone-512.png");
  await icone(v, 192, 0.5, 0, "public/icones/icone-maskable-192.png");
  await icone(v, 512, 0.5, 0, "public/icones/icone-maskable-512.png");
  console.log("marca brasa gerada");
})();
