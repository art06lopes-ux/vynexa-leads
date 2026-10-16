import { atualizarProjeto, excluirProjeto } from "@/db/carteira";
import { CamposProjeto, centavos } from "@/server/esquema-projeto";
import { ErroApi, json, lerCorpo, rota } from "@/server/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = rota(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const c = await lerCorpo(req, CamposProjeto.partial());
  const ok = await atualizarProjeto(id, {
    nome: c.nome,
    leadId: c.leadId === undefined ? undefined : c.leadId || null,
    clienteNome: c.clienteNome === undefined ? undefined : c.clienteNome || null,
    tipo: c.tipo,
    status: c.status,
    url: c.url,
    prazo: c.prazo,
    valorCentavos: centavos(c.valor, "Valor"),
    custoCentavos: centavos(c.custo, "Custo"),
    observacoes: c.observacoes === undefined ? undefined : c.observacoes || null,
  });
  if (!ok) throw new ErroApi("Projeto não encontrado.", 404);
  return json({ ok: true });
}, { recurso: "sites" });

export const DELETE = rota(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await excluirProjeto(id))) throw new ErroApi("Projeto não encontrado.", 404);
  return json({ ok: true });
}, { recurso: "sites" });
