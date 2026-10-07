import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste, lugar } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
});

const n = async (sql: string) => Number((await banco.execute(sql)).rows[0]!.n);

describe("começar do zero", () => {
  it("apaga a carteira, mantém configuração e supressão; continua de onde parou", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { registrarVenda } = await import("@/services/financeiro");
    const { zerarDados } = await import("@/services/zerar");

    await banco.execute(`INSERT INTO buscas (id, segmento, pais, provedor, status) VALUES ('bz', 'barbearia', 'BR', 'google_places', 'concluida')`);
    await registrarLugares(banco, [lugar({ externoId: "z1", nome: "Empresa Z1" }), lugar({ externoId: "z2", nome: "Empresa Z2" })], { buscaId: "bz" });
    const lead = String((await banco.execute(`SELECT id FROM leads LIMIT 1`)).rows[0]!.id);
    await registrarVenda(banco, {
      leadId: lead, produtoId: null, descricao: "Site", valorCentavos: 1000, moeda: "BRL", meioPagamento: "pix", pago: true,
      cliente: { nome: "Cliente", empresa: "Empresa Z1", email: null, telefone: null, documento: null },
    });
    await banco.execute(`INSERT INTO supressao (tipo, valor, motivo, origem) VALUES ('email', 'nao@exemplo.com', 'opt-out', 'descadastro')`);
    await banco.execute(`INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('empresa_nome', 'Vynexa Dev')`);

    // Orçamento zero: para antes de apagar e diz quanto falta.
    const parcial = await zerarDados(banco, { incluirVendas: false, orcamentoMs: -1 });
    assert.equal(parcial.concluido, false);
    assert.ok(parcial.restantes > 0);

    const r = await zerarDados(banco, { incluirVendas: false, orcamentoMs: 30_000 });
    assert.equal(r.concluido, true);
    assert.equal(await n(`SELECT COUNT(*) n FROM leads`), 0);
    assert.equal(await n(`SELECT COUNT(*) n FROM empresas`), 0);
    assert.equal(await n(`SELECT COUNT(*) n FROM buscas`), 0);
    assert.equal(await n(`SELECT COUNT(*) n FROM vendas WHERE lead_id IS NULL`), 1, "venda fica, sem o lead");
    assert.equal(await n(`SELECT COUNT(*) n FROM supressao`), 1, "não contatar é mantido");
    assert.equal(await n(`SELECT COUNT(*) n FROM configuracoes WHERE chave = 'empresa_nome'`), 1);

    await zerarDados(banco, { incluirVendas: true, orcamentoMs: 30_000 });
    assert.equal(await n(`SELECT COUNT(*) n FROM vendas`), 0);
  });
});
