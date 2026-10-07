import { codigoDoPaisPorNome } from "@/lib/geo/mundo";
import { simplificar } from "@/services/normalizacao";

import type { LugarEncontrado } from "./tipos";

/**
 * Importação de planilha CSV.
 *
 * Aceita vírgula ou ponto e vírgula (o Excel em português exporta com
 * ponto e vírgula), aspas com aspas escapadas, e reconhece o cabeçalho
 * em português ou inglês. Coluna que não existe fica nula — a importação
 * não "completa" nada.
 */

const SINONIMOS: Record<keyof Omit<LugarEncontrado, "fonte" | "externoId" | "statusNegocio" | "categoriaRotulo">, string[]> = {
  nome: ["nome", "name", "empresa", "company", "razao social", "nome fantasia", "business"],
  categoria: ["categoria", "category", "segmento", "nicho", "tipo"],
  pais: ["pais", "country", "pais iso"],
  estado: ["estado", "state", "uf", "provincia", "region", "regiao"],
  cidade: ["cidade", "city", "municipio", "town"],
  bairro: ["bairro", "neighborhood", "district"],
  cep: ["cep", "zip", "postal code", "codigo postal", "zipcode"],
  endereco: ["endereco", "address", "logradouro", "rua"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  telefone: ["telefone", "phone", "fone", "celular", "whatsapp", "tel"],
  email: ["email", "e mail", "mail"],
  website: ["website", "site", "url", "web"],
  instagram: ["instagram", "insta"],
  facebook: ["facebook", "fb"],
  fonteUrl: ["google maps", "maps", "link", "google maps url"],
  avaliacaoNota: ["rating", "nota", "avaliacao", "estrelas"],
  avaliacaoQtd: ["reviews", "avaliacoes", "numero de avaliacoes", "qtd avaliacoes", "review count"],
};

export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] ?? "";
  const separador = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i += 1;
      linha.push(campo);
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

export type ResultadoCsv = { lugares: LugarEncontrado[]; ignoradas: number; colunas: string[] };

export function converterCsv(texto: string, padrao: { pais: string | null; categoria: string }): ResultadoCsv {
  const [cabecalho, ...corpo] = lerCsv(texto);
  if (!cabecalho) return { lugares: [], ignoradas: 0, colunas: [] };

  const indice = new Map<string, number>();
  cabecalho.forEach((titulo, i) => {
    const t = simplificar(titulo);
    for (const [campo, nomes] of Object.entries(SINONIMOS)) {
      if (!indice.has(campo) && nomes.includes(t)) indice.set(campo, i);
    }
  });
  if (!indice.has("nome")) throw new Error('A planilha precisa de uma coluna "nome" (ou "name").');

  const valor = (linha: string[], campo: string): string | null => {
    const i = indice.get(campo);
    const v = i === undefined ? "" : (linha[i] ?? "").trim();
    return v === "" ? null : v;
  };
  const numero = (linha: string[], campo: string): number | null => {
    const v = valor(linha, campo);
    if (v === null) return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  let ignoradas = 0;
  const lugares: LugarEncontrado[] = [];
  for (const linha of corpo) {
    const nome = valor(linha, "nome");
    if (!nome) {
      ignoradas += 1;
      continue;
    }
    const paisBruto = valor(linha, "pais");
    const pais = paisBruto ? (/^[a-z]{2}$/i.test(paisBruto) ? paisBruto.toUpperCase() : codigoDoPaisPorNome(paisBruto)) : padrao.pais;
    if (!pais) {
      ignoradas += 1;
      continue;
    }
    lugares.push({
      fonte: "csv",
      externoId: null,
      fonteUrl: valor(linha, "fonteUrl"),
      nome: nome.slice(0, 200),
      categoria: valor(linha, "categoria") ?? padrao.categoria,
      categoriaRotulo: valor(linha, "categoria"),
      pais,
      estado: valor(linha, "estado"),
      cidade: valor(linha, "cidade"),
      bairro: valor(linha, "bairro"),
      cep: valor(linha, "cep"),
      endereco: valor(linha, "endereco"),
      latitude: numero(linha, "latitude"),
      longitude: numero(linha, "longitude"),
      telefone: valor(linha, "telefone"),
      email: valor(linha, "email"),
      website: valor(linha, "website"),
      instagram: valor(linha, "instagram"),
      facebook: valor(linha, "facebook"),
      avaliacaoNota: numero(linha, "avaliacaoNota"),
      avaliacaoQtd: numero(linha, "avaliacaoQtd"),
      statusNegocio: null,
    });
  }
  return { lugares, ignoradas, colunas: [...indice.keys()] };
}
