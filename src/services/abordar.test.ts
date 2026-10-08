import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste, lugar } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
});

const leadDe = async (placeId: string) =>
  String((await banco.execute({ sql: `SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id = ?`, args: [placeId] })).rows[0]!.id);

describe("fila de abordagem", () => {
  it("só quem tem canal, não foi contatado nem bloqueado; melhor score primeiro; filtra pela busca", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { registrarContato } = await import("@/services/acoes-lead");
    const { carregarFila } = await import("@/db/abordar");

    await banco.execute(`INSERT INTO buscas (id, segmento, pais, provedor, status) VALUES ('bf', 'solar', 'BR', 'google_places', 'concluida')`);
    await registrarLugares(
      banco,
      [
        lugar({ externoId: "a1", nome: "Whats Bom", telefone: "+55 92 99111-0001", avaliacaoNota: 4.9, avaliacaoQtd: 200 }),
        lugar({ externoId: "a2", nome: "Só E-mail", telefone: null, email: "contato@soemail.com.br", website: "https://soemail.com.br" }),
        lugar({ externoId: "a3", nome: "Sem Canal", telefone: null }),
        lugar({ externoId: "a4", nome: "Já Contatada", telefone: "+55 92 99111-0004" }),
        lugar({ externoId: "a5", nome: "Bloqueada", telefone: "+55 92 99111-0005" }),
      ],
      { buscaId: "bf" },
    );
    await registrarLugares(banco, [lugar({ externoId: "fora", nome: "Outra Busca", telefone: "+55 92 99111-0009" })], { buscaId: null });
    await registrarContato(banco, await leadDe("a4"), "whatsapp_aberto");
    await banco.execute(`UPDATE empresas SET nao_contatar = 1 WHERE place_id = 'a5'`);

    const fila = await carregarFila(banco, { buscaId: "bf" });
    assert.deepEqual(fila.map((i) => i.nome).sort(), ["Só E-mail", "Whats Bom"]);
    assert.equal(fila[0].nome, "Whats Bom", "maior score primeiro");
    assert.equal(fila[0].numeroWhats, "5592991110001");
    assert.equal(fila.find((i) => i.nome === "Só E-mail")!.numeroWhats, null);
    assert.ok(fila[0].motivos.length > 0);

    const todos = await carregarFila(banco, {});
    assert.ok(todos.some((i) => i.nome === "Outra Busca"), "sem busca: todos os não abordados");

    const sel = await carregarFila(banco, { leadIds: [await leadDe("a1")] });
    assert.deepEqual(sel.map((i) => i.nome), ["Whats Bom"]);
  });

  it("retomar contato: abordados há 3+ dias sem resposta, nunca quem respondeu ou pediu para sair", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { registrarContato, registrarResposta } = await import("@/services/acoes-lead");
    const { paraRetomar } = await import("@/db/painel");
    await registrarLugares(
      banco,
      [
        lugar({ externoId: "r1", nome: "Esfriando", telefone: "+55 92 99222-0001" }),
        lugar({ externoId: "r2", nome: "Respondeu", telefone: "+55 92 99222-0002" }),
        lugar({ externoId: "r3", nome: "Recente", telefone: "+55 92 99222-0003" }),
      ],
      { buscaId: null },
    );
    for (const id of ["r1", "r2", "r3"]) await registrarContato(banco, await leadDe(id), "whatsapp_aberto");
    await registrarResposta(banco, await leadDe("r2"));
    const antigos = `(SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id IN ('r1', 'r2'))`;
    await banco.execute(`UPDATE leads SET contatado_em = datetime('now', '-5 days') WHERE id IN ${antigos}`);
    await banco.execute(`UPDATE eventos SET criado_em = datetime('now', '-5 days') WHERE lead_id IN ${antigos}`);
    const nomes = (await paraRetomar(10)).itens.map((r) => r.nome);
    assert.ok(nomes.includes("Esfriando"));
    assert.ok(!nomes.includes("Respondeu"));
    assert.ok(!nomes.includes("Recente"));

    // Retomou hoje: sai da lista até passarem mais 3 dias.
    await registrarContato(banco, await leadDe("r1"), "whatsapp_aberto");
    assert.ok(!(await paraRetomar(10)).itens.some((r) => r.nome === "Esfriando"));
    const { listarLeads } = await import("@/db/leads");
    assert.equal((await listarLeads({ situacao: "retomar" })).itens.some((l) => l.nome === "Esfriando"), false);
  });
});
