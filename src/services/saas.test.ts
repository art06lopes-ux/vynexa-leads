import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste, lugar } from "@/test/banco";

let principal: Client;

before(async () => {
  principal = await bancoDeTeste();
  // Bancos das contas (arquivos) numa pasta temporária, não no projeto.
  process.chdir(mkdtempSync(join(tmpdir(), "vynexa-contas-")));
});

describe("sessão do SaaS", () => {
  it("lê o cookie novo, aceita o antigo como dono e recusa adulteração", async () => {
    const { criarValorDeSessao, lerSessao } = await import("@/lib/auth");
    const { valor } = await criarValorDeSessao("u1", "conta-a");
    assert.deepEqual(await lerSessao(valor), { usuario: "u1", conta: "conta-a" });

    const trocado = valor.replace("~conta-a~", "~conta-b~");
    assert.equal(await lerSessao(trocado), null, "trocar a conta invalida a assinatura");

    const { valor: dono } = await criarValorDeSessao(null, "principal");
    assert.deepEqual(await lerSessao(dono), { usuario: null, conta: "principal" });
  });
});

describe("acesso por situação da conta", () => {
  it("teste e ativa valem até o vencimento + carência; bloqueada nunca", async () => {
    const { acessoDaConta, estenderValidade, CARENCIA_DIAS } = await import("@/services/contas");
    const agora = Date.parse("2026-10-15T12:00:00Z");
    const base = { id: "x", nome: "X", plano: "pro", banco_tipo: "arquivo" } as never as Parameters<typeof acessoDaConta>[0];
    assert.equal(acessoDaConta({ ...base, status: "teste", valida_ate: "2026-10-20 00:00:00" }, agora).liberado, true);
    assert.equal(acessoDaConta({ ...base, status: "atrasada", valida_ate: `2026-10-${15 - CARENCIA_DIAS + 1} 00:00:00` }, agora).liberado, true, "dentro da carência");
    assert.equal(acessoDaConta({ ...base, status: "atrasada", valida_ate: "2026-10-01 00:00:00" }, agora).liberado, false);
    assert.equal(acessoDaConta({ ...base, status: "bloqueada", valida_ate: "2027-01-01 00:00:00" }, agora).liberado, false);
    assert.equal(acessoDaConta({ ...base, id: "principal", status: "bloqueada", valida_ate: null }, agora).liberado, true, "o dono sempre entra");

    assert.equal(estenderValidade("2026-10-20 00:00:00", 31, agora), "2026-11-20 00:00:00", "soma a partir do vencimento futuro");
    assert.equal(estenderValidade("2026-09-01 00:00:00", 31, agora).slice(0, 10), "2026-11-15", "vencida: soma a partir de hoje");
  });
});

describe("contas isoladas", () => {
  it("cadastro cria banco próprio; o que uma conta grava a outra não vê", async () => {
    const { criarConta } = await import("@/services/contas");
    const { comConta } = await import("@/db/contas-banco");
    const { getBanco } = await import("@/db/cliente");

    const a = await criarConta({ nome: "Ana", empresa: "Estúdio A", email: "ana@exemplo.com", senha: "senhaA123", telefone: null, plano: "pro" });
    const b = await criarConta({ nome: "Bia", empresa: "Estúdio B", email: "bia@exemplo.com", senha: "senhaB123", telefone: null, plano: "essencial" });
    assert.equal(a.avisoBanco, null);
    assert.equal(a.conta.banco_tipo, "arquivo");

    const nomeEm = (conta: string) =>
      comConta(conta, async () => String((await getBanco().execute(`SELECT valor FROM configuracoes WHERE chave = 'empresa_nome'`)).rows[0]?.valor ?? ""));
    assert.equal(await nomeEm(a.conta.id), "Estúdio A");
    assert.equal(await nomeEm(b.conta.id), "Estúdio B");

    await comConta(a.conta.id, () => getBanco().execute(`INSERT INTO buscas (id, segmento, pais, provedor, status) VALUES ('so-da-a', 'barbearia', 'BR', 'osm', 'concluida')`));
    const contar = (conta: string) => comConta(conta, async () => Number((await getBanco().execute(`SELECT COUNT(*) n FROM buscas WHERE id = 'so-da-a'`)).rows[0]!.n));
    assert.equal(await contar(a.conta.id), 1);
    assert.equal(await contar(b.conta.id), 0);
    assert.equal(Number((await principal.execute(`SELECT COUNT(*) n FROM buscas WHERE id = 'so-da-a'`)).rows[0]!.n), 0, "nem o banco do dono");

    await assert.rejects(criarConta({ nome: "Ana 2", empresa: "", email: "ANA@exemplo.com", senha: "senhaA123", telefone: null, plano: "pro" }), /Já existe/);
  });

  it("assinante não herda a chave do Google do dono", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "chave-do-dono-123456";
    const { obterSegredo } = await import("@/integrations/segredos");
    const { comConta } = await import("@/db/contas-banco");
    const { rows } = await principal.execute(`SELECT id FROM contas WHERE id <> 'principal' LIMIT 1`);
    assert.equal(await obterSegredo("GOOGLE_PLACES_API_KEY"), "chave-do-dono-123456");
    assert.equal(await comConta(String(rows[0]!.id), () => obterSegredo("GOOGLE_PLACES_API_KEY")), null);
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it("limite de leads do plano corta os novos e conta o uso do mês", async () => {
    const { criarConta, salvarPlano, usoDoMes } = await import("@/services/contas");
    const { comConta } = await import("@/db/contas-banco");
    const { getBanco } = await import("@/db/cliente");
    const { registrarLugares } = await import("@/services/registro");

    await salvarPlano({ id: "essencial", nome: "Essencial", descricao: "", precoCentavos: 2990, destaque: false, limites: { leads_mes: 3, usuarios: 1, ia_mes: 0 } });
    const { conta } = await criarConta({ nome: "Caio", empresa: "Estúdio C", email: "caio@exemplo.com", senha: "senhaC123", telefone: null, plano: "essencial" });

    const r = await comConta(conta.id, () =>
      registrarLugares(getBanco(), [1, 2, 3, 4, 5].map((i) => lugar({ externoId: `lim-${i}`, nome: `Empresa ${i}`, telefone: `+55929999900${i}` })), { buscaId: null }),
    );
    assert.equal(r.novos, 3);
    assert.equal(r.foraDoLimite, 2);
    assert.equal((await usoDoMes(conta.id)).leads, 3);
  });
});

describe("cobrança da assinatura (webhook do Asaas)", () => {
  it("pagamento ativa e estende uma vez só; vencida marca atrasada", async () => {
    const { criarConta, lerConta } = await import("@/services/contas");
    const { processarEventoSaas, referenciaSaas } = await import("@/services/assinatura");
    const { conta } = await criarConta({ nome: "Duda", empresa: "Estúdio D", email: "duda@exemplo.com", senha: "senhaD123", telefone: null, plano: "pro" });
    const pagamento = { id: "pay_1", value: 59.9, dueDate: "2026-10-15", billingType: "PIX", externalReference: referenciaSaas(conta.id, "agencia") };

    assert.equal(await processarEventoSaas({ event: "PAYMENT_RECEIVED", payment: pagamento }), true);
    const depois = (await lerConta(conta.id))!;
    assert.equal(depois.status, "ativa");
    assert.equal(depois.plano, "agencia", "o plano vem da referência da cobrança");

    await processarEventoSaas({ event: "PAYMENT_CONFIRMED", payment: pagamento });
    assert.equal((await lerConta(conta.id))!.valida_ate, depois.valida_ate, "evento repetido não estende de novo");

    await processarEventoSaas({ event: "PAYMENT_OVERDUE", payment: { ...pagamento, id: "pay_2" } });
    assert.equal((await lerConta(conta.id))!.status, "atrasada");

    assert.equal(await processarEventoSaas({ event: "PAYMENT_RECEIVED", payment: { id: "venda_1", value: 900, externalReference: "id-de-uma-venda" } }), false, "venda do dono segue o fluxo antigo");
  });
});
