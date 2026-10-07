import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { converterCsv } from "@/integrations/leads/csv";
import type { LugarEncontrado } from "@/integrations/leads/tipos";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import { registrarLugares } from "@/services/registro";
import { enfileirarUmaVez } from "@/worker/handlers/busca-provedor";

/**
 * Importação manual: planilha CSV ou um lead digitado. Passa pelo mesmo
 * registro das buscas — dedup, supressão, score e histórico.
 */
export const maxDuration = 60;

const Corpo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("csv"),
    conteudo: z.string().min(5).max(5_000_000),
    paisPadrao: z.string().regex(/^[A-Z]{2}$/).nullable(),
    categoriaPadrao: z.string().trim().min(2).max(80),
  }),
  z.object({
    tipo: z.literal("manual"),
    nome: z.string().trim().min(2).max(200),
    categoria: z.string().trim().min(2).max(80),
    pais: z.string().regex(/^[A-Z]{2}$/),
    estado: z.string().trim().max(80).optional(),
    cidade: z.string().trim().max(120).optional(),
    endereco: z.string().trim().max(300).optional(),
    telefone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(160).optional(),
    website: z.string().trim().max(300).optional(),
    instagram: z.string().trim().max(160).optional(),
  }),
]);

export const POST = rota(async (req) => {
  await limitar("importar", 30, 3600);
  const c = await lerCorpo(req, Corpo);
  const banco = getBanco();

  let lugares: LugarEncontrado[];
  let ignoradas = 0;
  if (c.tipo === "csv") {
    try {
      const r = converterCsv(c.conteudo, { pais: c.paisPadrao, categoria: c.categoriaPadrao });
      lugares = r.lugares;
      ignoradas = r.ignoradas;
    } catch (e) {
      throw new ErroApi(e instanceof Error ? e.message : "Planilha inválida.", 422);
    }
    if (lugares.length > 5000) throw new ErroApi("Importe no máximo 5.000 linhas por vez.", 422);
    if (lugares.length === 0) throw new ErroApi("Nenhuma linha válida encontrada (cada linha precisa de nome e país).", 422);
  } else {
    const v = (s?: string) => (s && s.trim() ? s.trim() : null);
    lugares = [
      {
        fonte: "manual", externoId: null, fonteUrl: null, nome: c.nome, categoria: c.categoria, categoriaRotulo: c.categoria, pais: c.pais,
        estado: v(c.estado), cidade: v(c.cidade), bairro: null, cep: null, endereco: v(c.endereco), latitude: null, longitude: null,
        telefone: v(c.telefone), email: v(c.email), website: v(c.website), instagram: v(c.instagram), facebook: null,
        avaliacaoNota: null, avaliacaoQtd: null, statusNegocio: null,
      },
    ];
  }

  const r = await registrarLugares(banco, lugares, { buscaId: null });
  if (r.novos > 0) await enfileirarUmaVez(banco, "avaliar_site", { limite: 20 });

  let leadId: string | null = null;
  if (c.tipo === "manual" && r.empresaIds[0]) {
    const { rows } = await banco.execute({ sql: `SELECT id FROM leads WHERE empresa_id = ?`, args: [r.empresaIds[0]] });
    leadId = rows[0]?.id ? String(rows[0].id) : null;
  }
  return json({ ...r, empresaIds: undefined, novosIds: undefined, ignoradas, leadId });
});
