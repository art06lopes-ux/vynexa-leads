import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import type { EmailProvider, MensagemEmail } from "@/integrations/email";
import { bancoDeTeste, lugar } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
});

async function um<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T> {
  const { rows } = await banco.execute({ sql, args: args as never });
  return rows[0] as unknown as T;
}

describe("registro de leads (busca → dedup → score)", () => {
  it("cria empresa, lead com score, evento e resultado da busca", async () => {
    const { registrarLugares } = await import("@/services/registro");
    await banco.execute(`INSERT INTO buscas (id, segmento, pais, provedor) VALUES ('b1', 'barbearia', 'BR', 'google_places')`);
    const r = await registrarLugares(
      banco,
      [
        lugar({ externoId: "p1", nome: "Barbearia X", telefone: "+55 92 99111-2222", avaliacaoNota: 4.8, avaliacaoQtd: 247 }),
        lugar({ externoId: "p2", nome: "Barbearia Y", website: "https://barbeariay.com.br" }),
      ],
      { buscaId: "b1" },
    );
    assert.equal(r.novos, 2);
    const lead = await um<{ score_oportunidade: number; prioridade: string; etapa: string }>(
      `SELECT l.* FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id = 'p1'`,
    );
    assert.ok(lead.score_oportunidade >= 80);
    assert.equal(lead.prioridade, "alta");
    assert.equal(lead.etapa, "novo");
    const ev = await um<{ n: number }>(`SELECT COUNT(*) n FROM eventos WHERE tipo = 'lead_encontrado'`);
    assert.equal(Number(ev.n), 2);
    const res = await um<{ n: number }>(`SELECT COUNT(*) n FROM busca_resultados WHERE busca_id = 'b1'`);
    assert.equal(Number(res.n), 2);
  });

  it("mesma empresa por outra fonte (telefone igual) completa em vez de duplicar", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const antes = await um<{ n: number }>(`SELECT COUNT(*) n FROM empresas`);
    const r = await registrarLugares(
      banco,
      [lugar({ fonte: "osm", externoId: "node/1", nome: "Barbearia X", telefone: "(92) 99111-2222", email: "x@barbeariax.com", avaliacaoNota: null })],
      { buscaId: null },
    );
    assert.equal(r.novos, 0);
    assert.equal(r.completados, 1);
    const depois = await um<{ n: number }>(`SELECT COUNT(*) n FROM empresas`);
    assert.equal(Number(depois.n), Number(antes.n));
    const e = await um<{ email: string; osm_id: string; avaliacao_nota: number }>(`SELECT * FROM empresas WHERE place_id = 'p1'`);
    assert.equal(e.email, "x@barbeariax.com");
    assert.equal(e.osm_id, "node/1");
    assert.equal(e.avaliacao_nota, 4.8, "nota existente não é apagada por nulo");
  });

  it("place_id repetido no mesmo lote entra uma vez", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const r = await registrarLugares(banco, [lugar({ externoId: "p9", nome: "A" }), lugar({ externoId: "p9", nome: "A" })], { buscaId: null });
    assert.equal(r.novos, 1);
    assert.equal(r.repetidosNoLote, 1);
  });

  it("contato na lista de supressão nasce bloqueado", async () => {
    const { registrarLugares } = await import("@/services/registro");
    await banco.execute(`INSERT INTO supressao (tipo, valor, motivo) VALUES ('telefone', '5592988887777', 'pediu')`);
    await registrarLugares(banco, [lugar({ externoId: "p10", nome: "Bloqueada", telefone: "+55 92 98888-7777" })], { buscaId: null });
    const e = await um<{ nao_contatar: number }>(`SELECT nao_contatar FROM empresas WHERE place_id = 'p10'`);
    assert.equal(Number(e.nao_contatar), 1);
  });
});

describe("campanha e fila de e-mail", () => {
  let campanhaId = "";

  it("não inclui quem não tem e-mail nem quem pediu para não ser contatado", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { criarCampanha } = await import("@/services/campanhas");
    await registrarLugares(
      banco,
      [
        lugar({ externoId: "c1", nome: "Com Email 1", email: "um@empresa1.com" }),
        lugar({ externoId: "c2", nome: "Com Email 2", email: "dois@empresa2.com" }),
        lugar({ externoId: "c3", nome: "Sem Email" }),
      ],
      { buscaId: null },
    );
    await banco.execute(`UPDATE empresas SET nao_contatar = 1 WHERE place_id = 'c2'`);
    const { rows } = await banco.execute(`SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id IN ('c1','c2','c3')`);
    const r = await criarCampanha(banco, {
      nome: "Barbearias sem site — Manacapuru",
      descricao: null,
      leadIds: rows.map((x) => String(x.id)),
      filtros: { site: "sem" },
      provedorEmail: "resend",
      ritmoPorHora: 60,
      limiteDiario: 50,
      followupDias: [3, 7],
    });
    campanhaId = r.id;
    assert.equal(r.incluidos, 1);
    assert.equal(r.semEmail, 1);
    assert.equal(r.bloqueados, 1);
    const envios = await um<{ n: number }>(`SELECT COUNT(*) n FROM envios WHERE campanha_id = ?`, [campanhaId]);
    assert.equal(Number(envios.n), 3, "primeira abordagem + 2 follow-ups");
    const job = await um<{ tipo: string }>(`SELECT tipo FROM jobs WHERE tipo = 'preparar_campanha'`);
    assert.equal(job.tipo, "preparar_campanha");
  });

  it("valida dias de follow-up", async () => {
    const { validarNovaCampanha } = await import("@/services/campanhas");
    const base = { nome: "X campanha", descricao: null, leadIds: ["a"], filtros: null, provedorEmail: "gmail" as const, ritmoPorHora: 10, limiteDiario: 10 };
    assert.ok(validarNovaCampanha({ ...base, followupDias: [7, 3] }));
    assert.equal(validarNovaCampanha({ ...base, followupDias: [3, 7] }), null);
  });

  it("nada sai antes de autorizar; depois, sai pelo provedor com rastreio e descadastro", async () => {
    const { autorizarCampanha } = await import("@/services/campanhas");
    const { enviarUm } = await import("@/services/envio");
    const { processarEnvioCampanha } = await import("@/worker/handlers/campanha-v2");

    // Simula o preparo (IA) escrevendo os textos.
    await banco.execute({
      sql: `UPDATE envios SET status = 'preparado', assunto = 'Uma ideia para a Com Email 1', corpo = 'Olá, equipe da Com Email 1. Encontrei vocês no Google e não encontrei um site próprio. Posso mostrar uma prévia?' WHERE campanha_id = ?`,
      args: [campanhaId],
    });
    await banco.execute({ sql: `UPDATE campanhas SET status = 'pronta' WHERE id = ?`, args: [campanhaId] });

    const antes = await processarEnvioCampanha(banco, { campanhaId });
    assert.match(antes, /não autorizada/);

    const enviadas: MensagemEmail[] = [];
    const falso: EmailProvider = {
      nome: "resend",
      rotulo: "falso",
      pronto: async () => ({ ok: true, motivo: null }),
      enviar: async (m) => {
        enviadas.push(m);
        return { id: `msg-${enviadas.length}` };
      },
    };

    await autorizarCampanha(banco, campanhaId, null);
    const { rows } = await banco.execute({
      sql: `SELECT id, lead_id, campanha_id, passo, destinatario, assunto, corpo, token FROM envios WHERE campanha_id = ? AND passo = 0`,
      args: [campanhaId],
    });
    const r = await enviarUm(banco, rows[0] as never, falso);
    assert.equal(r.ok, true);
    assert.equal(enviadas.length, 1);
    assert.ok(enviadas[0].html?.includes("/api/t/a/"), "pixel de abertura");
    assert.ok(enviadas[0].texto.includes("/descadastro/"), "link de descadastro no texto");
    assert.ok(enviadas[0].cabecalhos["List-Unsubscribe"]);

    const envio = await um<{ status: string; provedor_message_id: string; enviado_em: string }>(`SELECT * FROM envios WHERE id = ?`, [String(rows[0].id)]);
    assert.equal(envio.status, "enviado");
    const lead = await um<{ etapa: string; contatado_em: string }>(`SELECT etapa, contatado_em FROM leads WHERE id = ?`, [String(rows[0].lead_id)]);
    assert.equal(lead.etapa, "abordado");
    assert.ok(lead.contatado_em);
    const follow = await um<{ status: string; agendado_para: string }>(`SELECT status, agendado_para FROM envios WHERE campanha_id = ? AND passo = 1`, [campanhaId]);
    assert.equal(follow.status, "agendado");
    assert.ok(follow.agendado_para > envio.enviado_em, "follow-up agendado para dias depois");
    const dias = (Date.parse(follow.agendado_para.replace(" ", "T") + "Z") - Date.parse(envio.enviado_em.replace(" ", "T") + "Z")) / 86_400_000;
    assert.equal(Math.round(dias), 3);

    // Segunda chamada com o mesmo envio não manda de novo.
    const de_novo = await enviarUm(banco, rows[0] as never, falso);
    assert.equal(de_novo.ok, false);
    assert.equal(enviadas.length, 1);
  });

  it("follow-up é cancelado se o lead respondeu", async () => {
    const { enviarUm } = await import("@/services/envio");
    const f = await um<Record<string, unknown>>(`SELECT * FROM envios WHERE campanha_id = ? AND passo = 1`, [campanhaId]);
    await banco.execute({ sql: `UPDATE leads SET etapa = 'respondeu' WHERE id = ?`, args: [String(f.lead_id)] });
    const r = await enviarUm(banco, f as never, {
      nome: "resend", rotulo: "x", pronto: async () => ({ ok: true, motivo: null }),
      enviar: async () => {
        throw new Error("não deveria enviar");
      },
    });
    assert.equal(r.ok, false);
    const depois = await um<{ status: string }>(`SELECT status FROM envios WHERE id = ?`, [String(f.id)]);
    assert.equal(depois.status, "cancelado");
  });

  it("descadastro cancela envios pendentes e entra na supressão", async () => {
    const { marcarNaoContatar } = await import("@/services/supressao");
    const e = await um<{ id: string }>(`SELECT id FROM empresas WHERE place_id = 'c1'`);
    await marcarNaoContatar(banco, e.id, "Pediu pelo link", "descadastro");
    const pend = await um<{ n: number }>(`SELECT COUNT(*) n FROM envios WHERE campanha_id = ? AND status IN ('pendente','preparado','agendado')`, [campanhaId]);
    assert.equal(Number(pend.n), 0);
    const s = await um<{ n: number }>(`SELECT COUNT(*) n FROM supressao WHERE valor = 'um@empresa1.com'`);
    assert.equal(Number(s.n), 1);
  });
});

describe("venda, webhook do Asaas e notificação", () => {
  it("webhook confirma a venda uma vez só e notifica", async () => {
    const { registrarVenda, processarWebhookAsaas } = await import("@/services/financeiro");
    const lead = await um<{ id: string }>(`SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id = 'p1'`);
    const vendaId = await registrarVenda(banco, {
      leadId: lead.id, produtoId: null, descricao: "Site Profissional", valorCentavos: 35000, moeda: "BRL", meioPagamento: null, pago: false,
      cliente: { nome: "João Silva", empresa: "Barbearia X", email: null, telefone: null, documento: null },
    });
    const l = await um<{ etapa: string }>(`SELECT etapa FROM leads WHERE id = ?`, [lead.id]);
    assert.equal(l.etapa, "fechado");

    await banco.execute({
      sql: `INSERT INTO cobrancas (id, venda_id, provedor, externo_id, status, valor_centavos) VALUES ('cb1', ?, 'asaas', 'pay_123', 'pendente', 35000)`,
      args: [vendaId],
    });
    const evento = { id: "evt_1", event: "PAYMENT_CONFIRMED", payment: { id: "pay_123", status: "CONFIRMED", value: 350, billingType: "PIX", externalReference: vendaId } };
    const r1 = await processarWebhookAsaas(banco, evento, JSON.stringify(evento));
    assert.equal(r1.vendaPaga, true);
    const r2 = await processarWebhookAsaas(banco, evento, JSON.stringify(evento));
    assert.equal(r2.duplicado, true);
    // RECEIVED depois de CONFIRMED não comemora de novo.
    const recebido = { ...evento, id: "evt_2", event: "PAYMENT_RECEIVED" };
    const r3 = await processarWebhookAsaas(banco, recebido, JSON.stringify(recebido));
    assert.equal(r3.vendaPaga, false);

    const venda = await um<{ status: string; meio_pagamento: string }>(`SELECT * FROM vendas WHERE id = ?`, [vendaId]);
    assert.equal(venda.status, "pago");
    assert.equal(venda.meio_pagamento, "pix");
    const n = await um<{ n: number; dados: string }>(`SELECT COUNT(*) n, MAX(dados) dados FROM notificacoes WHERE tipo = 'venda'`);
    assert.equal(Number(n.n), 1);
    const dados = JSON.parse(n.dados) as { cliente: string; empresa: string; valorCentavos: number };
    assert.equal(dados.cliente, "João Silva");
    assert.equal(dados.empresa, "Barbearia X");
    assert.equal(dados.valorCentavos, 35000);
    const cob = await um<{ status: string }>(`SELECT status FROM cobrancas WHERE id = 'cb1'`);
    assert.equal(cob.status, "recebido");
  });

  it("gerar o link de cobrança avisa; o pagamento pelo link avisa de novo", async () => {
    const { registrarVenda, emitirCobranca, processarWebhookAsaas } = await import("@/services/financeiro");
    const { definirPagamentos } = await import("@/integrations/pagamentos/asaas");
    definirPagamentos({
      nome: "falso",
      pronto: async () => ({ ok: true, motivo: null, ambiente: "sandbox" }),
      criarCobranca: async () => ({ externoId: "pay_link", clienteExternoId: "cus_1", link: "https://sandbox.asaas.com/i/pay_link", status: "PENDING" }),
    } as unknown as Parameters<typeof definirPagamentos>[0]);
    try {
      const vendaId = await registrarVenda(banco, {
        leadId: null, produtoId: null, descricao: "Landing page", valorCentavos: 50000, moeda: "BRL", meioPagamento: null, pago: false,
        cliente: { nome: "Ana", empresa: "Hamburgueria Y", email: null, telefone: null, documento: null },
      });
      const { link } = await emitirCobranca(banco, { vendaId, forma: "PIX", vencimento: "2026-10-20", documento: "52998224725", email: null, telefone: null, nome: "Ana" });
      assert.equal(link, "https://sandbox.asaas.com/i/pay_link");
      const gerado = await um<{ titulo: string; corpo: string }>(`SELECT titulo, corpo FROM notificacoes WHERE tipo = 'pagamento' ORDER BY rowid DESC LIMIT 1`);
      assert.equal(gerado.titulo, "Link de cobrança gerado");
      assert.match(gerado.corpo, /Hamburgueria Y · R\$\s?500,00 · vence 20\/10\/2026/);

      const ev = { id: "evt_link", event: "PAYMENT_RECEIVED", payment: { id: "pay_link", status: "RECEIVED", value: 500, billingType: "PIX" } };
      assert.equal((await processarWebhookAsaas(banco, ev, JSON.stringify(ev))).vendaPaga, true);
      const pago = await um<{ titulo: string; corpo: string }>(`SELECT titulo, corpo FROM notificacoes WHERE tipo = 'venda' ORDER BY rowid DESC LIMIT 1`);
      assert.match(pago.titulo, /^Pagamento recebido · R\$\s?500,00$/);
      assert.equal(pago.corpo, "Hamburgueria Y pagou no Pix · Landing page");
    } finally {
      definirPagamentos(null);
    }
  });

  it("evento de cobrança desconhecida é registrado e ignorado", async () => {
    const { processarWebhookAsaas } = await import("@/services/financeiro");
    const ev = { id: "evt_x", event: "PAYMENT_CONFIRMED", payment: { id: "pay_nao_existe" } };
    const r = await processarWebhookAsaas(banco, ev, JSON.stringify(ev));
    assert.equal(r.ignorado, true);
  });
});

describe("segredos de integração", () => {
  it("guarda cifrado e nunca devolve o valor", async () => {
    const { salvarSegredo, obterSegredo, estadoDosSegredos } = await import("@/integrations/segredos");
    await salvarSegredo("GOOGLE_PLACES_API_KEY", "AIzaTESTE-chave-de-mentira-1234");
    const bruto = await um<{ valor_cifrado: string }>(`SELECT valor_cifrado FROM integracoes WHERE chave = 'GOOGLE_PLACES_API_KEY'`);
    assert.ok(!bruto.valor_cifrado.includes("AIza"));
    assert.equal(await obterSegredo("GOOGLE_PLACES_API_KEY"), "AIzaTESTE-chave-de-mentira-1234");
    const estado = (await estadoDosSegredos()).find((s) => s.nome === "GOOGLE_PLACES_API_KEY");
    assert.equal(estado?.configurado, true);
    assert.equal(estado?.final, "1234");
    assert.ok(!JSON.stringify(estado).includes("AIza"));
  });
});
