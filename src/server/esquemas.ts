import { z } from "zod";

import { ETAPAS } from "@/services/crm";
import type { FiltrosLeads } from "@/db/leads";

/** Esquemas de entrada compartilhados pelas rotas. */

const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) => texto(max).optional().transform((v) => (v ? v : undefined));

export const NovaBusca = z.object({
  consultaNatural: opcional(300),
  // Com link do Maps a categoria sai do próprio link; sem ele, é obrigatória.
  termo: texto(80).default(""),
  linkMaps: z.string().trim().max(2000).optional(),
  provedor: z.enum(["google_places", "osm"]),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional(),
  estado: opcional(80),
  cidade: opcional(120),
  bairro: opcional(120),
  cep: opcional(20),
  local: opcional(160),
  raioKm: z.number().min(0).max(200).nullable().optional(),
  centro: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  retangulo: z
    .object({ sul: z.number(), oeste: z.number(), norte: z.number(), leste: z.number() })
    .refine((r) => r.norte > r.sul && r.leste > r.oeste, "Área inválida.")
    .nullable()
    .optional(),
  filtros: z
    .object({
      site: z.enum(["todos", "sem", "com", "ruim"]).default("todos"),
      comWhatsapp: z.boolean().default(false),
      comEmail: z.boolean().default(false),
      avaliacoesMin: z.number().int().min(0).max(100000).nullable().default(null),
      notaMin: z.number().min(0).max(5).nullable().default(null),
      scoreMin: z.number().int().min(0).max(100).nullable().default(null),
    })
    .default({ site: "todos", comWhatsapp: false, comEmail: false, avaliacoesMin: null, notaMin: null, scoreMin: null }),
  maxRequisicoes: z.number().int().min(1).max(60).default(10),
}).refine((b) => b.linkMaps || b.termo.length >= 2, { message: "Informe a categoria (ex.: barbearia).", path: ["termo"] });

const bool = z
  .union([z.boolean(), z.enum(["1", "0", "true", "false"])])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === "1" || v === "true"));
const num = z.coerce.number().optional();

export const FiltrosLeadsEsquema = z.object({
  q: opcional(120),
  categoria: opcional(120),
  pais: opcional(4),
  cidade: opcional(120),
  site: z.enum(["todos", "sem", "com", "ruim", "social"]).optional(),
  whatsapp: bool,
  email: bool,
  instagram: bool,
  scoreMin: num,
  avaliacoesMin: num,
  notaMin: num,
  etapa: z.enum(ETAPAS as [string, ...string[]]).optional(),
  prioridade: z.enum(["alta", "media", "baixa"]).optional(),
  fonte: z.enum(["google_places", "osm", "receita", "csv", "manual"]).optional(),
  busca: opcional(64),
  campanha: opcional(64),
  naoContatar: bool,
  analisado: bool,
  ordem: z.enum(["score", "recentes", "avaliacoes", "nome"]).optional(),
});

/** Lê filtros de uma URL (searchParams) com validação. */
export function filtrosDaUrl(params: URLSearchParams | Record<string, string | string[] | undefined>): FiltrosLeads {
  const obj: Record<string, string> = {};
  if (params instanceof URLSearchParams) params.forEach((v, k) => (obj[k] = v));
  else for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v !== "") obj[k] = v;
  const r = FiltrosLeadsEsquema.safeParse(obj);
  const f = (r.success ? r.data : {}) as FiltrosLeads;
  // A aba "Para abordar" de Leads é um filtro como os outros.
  if (obj.aba === "abordar") f.paraAbordar = true;
  return f;
}

export const ListaIds = z.array(z.string().min(8).max(64)).min(1).max(1000);
