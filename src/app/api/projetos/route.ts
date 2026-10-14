import { criarProjeto } from "@/db/carteira";
import { CamposProjeto, centavos } from "@/server/esquema-projeto";
import { json, lerCorpo, limitar, rota } from "@/server/api";

export const POST = rota(async (req) => {
  await limitar("projetos", 120, 3600);
  const c = await lerCorpo(req, CamposProjeto);
  const id = await criarProjeto({
    nome: c.nome,
    leadId: c.leadId || null,
    clienteNome: c.clienteNome || null,
    tipo: c.tipo,
    status: c.status,
    url: c.url,
    prazo: c.prazo ?? null,
    valorCentavos: centavos(c.valor, "Valor") ?? 0,
    custoCentavos: centavos(c.custo, "Custo") ?? 0,
    observacoes: c.observacoes || null,
  });
  return json({ id }, 201);
});
