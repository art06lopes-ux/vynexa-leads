import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { obterLead } from "@/db/leads";
import { paraCentavos } from "@/lib/pagamento/dinheiro";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";
import {
  adicionarNota,
  criarProposta,
  editarContato,
  mudarEtapa,
  mudarStatusProposta,
  registrarContato,
  registrarResposta,
} from "@/services/acoes-lead";
import { ETAPAS } from "@/services/crm";
import { enviarAvulso } from "@/services/envio";
import { registrarVenda } from "@/services/financeiro";
import { analisarEGravar, gerarAbordagens } from "@/services/inteligencia";
import { marcarNaoContatar } from "@/services/supressao";

/**
 * Ações sobre um lead. Uma rota, ações discriminadas por `acao` e
 * validadas uma a uma. A IA roda aqui mesmo (até 60 s): o operador está
 * olhando para o perfil esperando o resultado.
 */
export const maxDuration = 60;

const Acao = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("analisar") }),
  z.object({ acao: z.literal("abordagem"), soWhatsapp: z.boolean().optional() }),
  z.object({ acao: z.literal("etapa"), etapa: z.enum(ETAPAS as [string, ...string[]]), motivo: z.string().max(300).optional() }),
  z.object({ acao: z.literal("nota"), texto: z.string().trim().min(1).max(2000) }),
  z.object({ acao: z.literal("contato"), tipo: z.enum(["whatsapp_aberto", "mensagem_copiada", "contato_registrado"]), detalhe: z.string().max(200).optional() }),
  z.object({ acao: z.literal("respondeu") }),
  z.object({ acao: z.literal("email"), assunto: z.string().trim().min(3).max(150), corpo: z.string().trim().min(20).max(6000), para: z.string().email().optional() }),
  z.object({ acao: z.literal("nao_contatar"), motivo: z.string().trim().min(2).max(300) }),
  z.object({ acao: z.literal("proposta"), produtoId: z.string().max(64).nullable().optional(), valor: z.string().max(30).optional() }),
  z.object({ acao: z.literal("proposta_status"), propostaId: z.string().max(64), status: z.enum(["rascunho", "enviada", "aceita", "recusada"]) }),
  z.object({
    acao: z.literal("contatos"),
    telefone: z.string().max(40).nullable().optional(),
    email: z.string().max(160).nullable().optional(),
    instagram: z.string().max(160).nullable().optional(),
    website: z.string().max(300).nullable().optional(),
  }),
  z.object({
    acao: z.literal("venda"),
    produtoId: z.string().max(64).nullable(),
    descricao: z.string().trim().min(2).max(200),
    valor: z.string().trim().min(1).max(30),
    meio: z.enum(["pix", "boleto", "cartao", "transferencia", "dinheiro", "outro"]).nullable(),
    pago: z.boolean(),
    clienteNome: z.string().trim().max(120).optional(),
    clienteEmail: z.string().trim().max(160).optional(),
    clienteTelefone: z.string().trim().max(40).optional(),
    clienteDocumento: z.string().trim().max(20).optional(),
  }),
]);

export const POST = rota(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const corpo = await lerCorpo(req, Acao);
  const banco = getBanco();
  const lead = await obterLead(id);
  if (!lead) throw new ErroApi("Lead não encontrado.", 404);

  switch (corpo.acao) {
    case "analisar":
      await limitar("ia", 120, 3600);
      return json({ analise: await analisarEGravar(banco, id) });
    case "abordagem":
      await limitar("ia", 120, 3600);
      return json(await gerarAbordagens(banco, id, { semEmail: corpo.soWhatsapp === true }));
    case "etapa":
      return json(await mudarEtapa(banco, id, corpo.etapa as never, corpo.motivo));
    case "nota":
      await adicionarNota(banco, id, corpo.texto);
      return json({ ok: true });
    case "contato":
      if (lead.empresa.nao_contatar === 1 && corpo.tipo === "whatsapp_aberto") throw new ErroApi("Esta empresa pediu para não ser contatada.", 409);
      await registrarContato(banco, id, corpo.tipo, corpo.detalhe);
      return json({ ok: true });
    case "respondeu":
      await registrarResposta(banco, id);
      return json({ ok: true });
    case "email": {
      await limitar("email-avulso", 60, 3600);
      if (lead.empresa.nao_contatar === 1) throw new ErroApi("Esta empresa pediu para não ser contatada.", 409);
      const para = corpo.para ?? lead.empresa.email;
      if (!para) throw new ErroApi("Esta empresa não tem e-mail. Informe o destinatário.");
      const r = await enviarAvulso(banco, id, corpo.assunto, corpo.corpo, para);
      if (!r.ok) throw new ErroApi(`O e-mail não saiu: ${r.erro}`, r.temporario ? 503 : 422);
      return json({ ok: true, id: r.id });
    }
    case "nao_contatar":
      await marcarNaoContatar(banco, lead.empresa.id, corpo.motivo, "manual");
      return json({ ok: true });
    case "proposta": {
      await limitar("ia", 120, 3600);
      const valor = corpo.valor ? paraCentavos(corpo.valor) : null;
      return json({ id: await criarProposta(banco, id, corpo.produtoId ?? null, valor) });
    }
    case "proposta_status":
      await mudarStatusProposta(banco, corpo.propostaId, corpo.status);
      return json({ ok: true });
    case "contatos":
      await editarContato(banco, lead.empresa.id, corpo);
      return json({ ok: true });
    case "venda": {
      const valor = paraCentavos(corpo.valor);
      if (valor === null || valor <= 0) throw new ErroApi("Valor inválido.");
      const vendaId = await registrarVenda(banco, {
        leadId: id,
        produtoId: corpo.produtoId,
        descricao: corpo.descricao,
        valorCentavos: valor,
        moeda: "BRL",
        meioPagamento: corpo.meio,
        pago: corpo.pago,
        cliente: {
          nome: corpo.clienteNome || null,
          empresa: lead.empresa.nome,
          email: corpo.clienteEmail || lead.empresa.email,
          telefone: corpo.clienteTelefone || lead.empresa.telefone,
          documento: corpo.clienteDocumento || null,
        },
      });
      return json({ vendaId });
    }
  }
});
