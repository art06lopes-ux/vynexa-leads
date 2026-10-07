import { gerarCsv } from "@/lib/leads/csv";

/**
 * Exportação de leads em CSV, Excel (.xlsx) e JSON.
 *
 * O .xlsx é escrito à mão — um zip sem compressão com quatro arquivos
 * XML. Uma biblioteca de planilha inteira (centenas de KB) para gerar
 * uma aba de texto não se paga; e o formato mínimo abaixo é o que o
 * Excel, o LibreOffice e o Google Sheets abrem sem reclamar.
 */

export type LinhaExportacao = {
  nome: string;
  categoria: string;
  endereco: string | null;
  cidade: string | null;
  pais: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  google_maps: string | null;
  avaliacao_nota: number | null;
  avaliacao_qtd: number | null;
  score: number | null;
  status: string;
  etapa: string;
  fonte: string;
  descoberto_em: string;
};

export const COLUNAS: Array<{ chave: keyof LinhaExportacao; titulo: string }> = [
  { chave: "nome", titulo: "Nome" },
  { chave: "categoria", titulo: "Categoria" },
  { chave: "endereco", titulo: "Endereço" },
  { chave: "cidade", titulo: "Cidade" },
  { chave: "pais", titulo: "País" },
  { chave: "telefone", titulo: "Telefone" },
  { chave: "whatsapp", titulo: "WhatsApp" },
  { chave: "email", titulo: "Email" },
  { chave: "website", titulo: "Website" },
  { chave: "instagram", titulo: "Instagram" },
  { chave: "google_maps", titulo: "Google Maps" },
  { chave: "avaliacao_nota", titulo: "Rating" },
  { chave: "avaliacao_qtd", titulo: "Reviews" },
  { chave: "score", titulo: "Score" },
  { chave: "status", titulo: "Status" },
  { chave: "etapa", titulo: "Etapa" },
  { chave: "fonte", titulo: "Fonte" },
  { chave: "descoberto_em", titulo: "Data de descoberta" },
];

export function paraCsv(linhas: LinhaExportacao[]): string {
  return gerarCsv(
    COLUNAS.map((c) => c.titulo),
    linhas.map((l) => COLUNAS.map((c) => l[c.chave])),
  );
}

export function paraJson(linhas: LinhaExportacao[]): string {
  return JSON.stringify(linhas, null, 2);
}

// ---------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de controle quebram o XML do Excel.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function nomeColuna(indice: number): string {
  let n = indice + 1;
  let nome = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    n = Math.floor((n - 1) / 26);
  }
  return nome;
}

function celula(valor: unknown, ref: string): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}"><v>${valor}</v></c>`;
  // Texto que começa com = vira fórmula no Excel: injeção. Inline string
  // nunca é avaliada, mas o prefixo ' a mais protege quem converter.
  const texto = String(valor);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}

export function paraXlsx(linhas: LinhaExportacao[]): Uint8Array {
  const cabecalho = `<row r="1">${COLUNAS.map((c, i) => celula(c.titulo, `${nomeColuna(i)}1`)).join("")}</row>`;
  const corpo = linhas
    .map((l, r) => `<row r="${r + 2}">${COLUNAS.map((c, i) => celula(l[c.chave], `${nomeColuna(i)}${r + 2}`)).join("")}</row>`)
    .join("");

  const planilha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cabecalho}${corpo}</sheetData></worksheet>`;

  const arquivos: Array<[string, string]> = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    ["xl/worksheets/sheet1.xml", planilha],
  ];

  return zipSemCompressao(arquivos.map(([nome, texto]) => [nome, new TextEncoder().encode(texto)]));
}

// ---------------------------------------------------------------------
// ZIP (método 0, "stored") — o suficiente para um .xlsx.
// ---------------------------------------------------------------------

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i += 1) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipSemCompressao(arquivos: Array<[string, Uint8Array]>): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const [nome, dados] of arquivos) {
    const nomeBytes = new TextEncoder().encode(nome);
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeBytes.length, true);
    partes.push(new Uint8Array(local.buffer), nomeBytes, dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, dados.length, true);
    cd.setUint32(24, dados.length, true);
    cd.setUint16(28, nomeBytes.length, true);
    cd.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(cd.buffer), nomeBytes);

    deslocamento += 30 + nomeBytes.length + dados.length;
  }

  const tamanhoCentral = central.reduce((t, p) => t + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const total = todas.reduce((t, p) => t + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of todas) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}
