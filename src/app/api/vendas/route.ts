import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { paraCentavos } from "@/lib/pagamento/dinheiro";
import { ErroApi, json, lerCorpo, rota } from "@/server/api";
import { registrarVenda } from "@/services/financeiro";

/** Venda avulsa (sem lead de origem): cliente que chegou por indicação, etc. */
const Corpo = z.object({
  descricao: z.string().trim().min(2).max(200),
  valor: z.string().trim().min(1).max(30),
  produtoId: z.string().max(64).nullable(),
  meio: z.enum(["pix", "boleto", "cartao", "transferencia", "dinheiro", "outro"]).nullable(),
  pago: z.boolean(),
  clienteNome: z.string().trim().max(120).optional(),
  clienteEmpresa: z.string().trim().max(160).optional(),
  clienteEmail: z.string().trim().max(160).optional(),
  clienteTelefone: z.string().trim().max(40).optional(),
  clienteDocumento: z.string().trim().max(20).optional(),
});

export const POST = rota(async (req) => {
  const c = await lerCorpo(req, Corpo);
  const valor = paraCentavos(c.valor);
  if (!valor || valor <= 0) throw new ErroApi("Valor inválido.");
  const id = await registrarVenda(getBanco(), {
    leadId: null,
    produtoId: c.produtoId,
    descricao: c.descricao,
    valorCentavos: valor,
    moeda: "BRL",
    meioPagamento: c.meio,
    pago: c.pago,
    cliente: {
      nome: c.clienteNome || null,
      empresa: c.clienteEmpresa || null,
      email: c.clienteEmail || null,
      telefone: c.clienteTelefone || null,
      documento: c.clienteDocumento || null,
    },
  });
  return json({ id }, 201);
});
