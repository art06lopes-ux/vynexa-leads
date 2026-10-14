import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste, lugar } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
});

describe("projetos", () => {
  it("cria, edita só o que veio e marca a primeira publicação", async () => {
    const { atualizarProjeto, criarProjeto, excluirProjeto, listarProjetos } = await import("@/db/carteira");
    const id = await criarProjeto({ nome: "Site Barbearia", clienteNome: "Barbearia X", tipo: "site", status: "desenvolvimento", url: "https://x.vercel.app", valorCentavos: 150000, custoCentavos: 20000 });

    assert.equal(await atualizarProjeto(id, { status: "publicado" }), true);
    let [p] = await listarProjetos();
    assert.equal(p.url, "https://x.vercel.app", "editar o status não apaga o endereço");
    assert.equal(p.valor_centavos, 150000);
    assert.ok(p.publicado_em, "publicar carimba a data");
    const primeira = p.publicado_em;

    await atualizarProjeto(id, { status: "revisao" });
    await atualizarProjeto(id, { status: "publicado" });
    [p] = await listarProjetos();
    assert.equal(p.publicado_em, primeira, "republicar mantém a data da primeira publicação");

    assert.equal(await atualizarProjeto("nao-existe", { status: "arquivado" }), false);
    assert.equal(await excluirProjeto(id), true);
    assert.equal((await listarProjetos()).length, 0);
  });

  it("o esquema completa o https e deixa ausente o que não veio", async () => {
    const { CamposProjeto } = await import("@/server/esquema-projeto");
    const novo = CamposProjeto.parse({ nome: "Loja", tipo: "loja", status: "briefing", url: "loja.vercel.app" });
    assert.equal(novo.url, "https://loja.vercel.app");
    const parcial = CamposProjeto.partial().parse({ status: "publicado" });
    assert.equal(parcial.url, undefined, "PATCH sem url não vira null");
    assert.equal(CamposProjeto.partial().safeParse({ url: "sem ponto" }).success, false);
  });
});

describe("carteira", () => {
  it("lista só quem respondeu em diante, com a receita paga e a entrega", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { registrarVenda } = await import("@/services/financeiro");
    const { carteira, criarProjeto, receitaTotal } = await import("@/db/carteira");

    await registrarLugares(banco, [lugar({ externoId: "c1", nome: "Cliente Um" }), lugar({ externoId: "c2", nome: "Ainda Novo" })], { buscaId: null });
    const um = String((await banco.execute(`SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.nome = 'Cliente Um'`)).rows[0]!.id);
    await registrarVenda(banco, {
      leadId: um, produtoId: null, descricao: "Site", valorCentavos: 120000, custoCentavos: 30000, moeda: "BRL", meioPagamento: "pix", pago: true,
      cliente: { nome: null, empresa: "Cliente Um", email: null, telefone: null, documento: null },
    });
    await criarProjeto({ nome: "Site Cliente Um", leadId: um, tipo: "site", status: "revisao" });

    const lista = await carteira();
    assert.deepEqual(lista.map((c) => c.nome), ["Cliente Um"], "lead novo não entra na carteira");
    assert.equal(lista[0].etapa, "fechado", "venda registrada fecha o lead");
    assert.equal(lista[0].receita, 120000);
    assert.equal(lista[0].projeto_status, "revisao");
    assert.equal(await receitaTotal(), 120000);

    const custo = Number((await banco.execute(`SELECT custo_centavos c FROM vendas WHERE lead_id = '${um}'`)).rows[0]!.c);
    assert.equal(custo, 30000, "o custo da venda é gravado");
  });
});

describe("prompts", () => {
  it("salva, favorita primeiro e exclui", async () => {
    const { excluirPrompt, listarPrompts, marcarFavorito, salvarPrompt } = await import("@/db/prompts");
    const a = await salvarPrompt({ titulo: "A", modo: "ideia", formato: "texto", entrada: "ideia a", saida: "prompt a completo" });
    const b = await salvarPrompt({ titulo: "B", modo: "melhorar", formato: "json", entrada: "ideia b", saida: "{}" });
    await marcarFavorito(a, true);
    const lista = await listarPrompts();
    assert.equal(lista[0].id, a, "favorito vem antes");
    assert.equal(lista[0].favorito, 1);
    assert.equal(await excluirPrompt(b), true);
    assert.equal((await listarPrompts()).length, 1);
  });
});
