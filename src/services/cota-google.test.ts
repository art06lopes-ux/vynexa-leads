import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
});

describe("trava mensal do Google", () => {
  it("conta por mês, respeita o limite configurado e sobrevive ao 'começar do zero'", async () => {
    const { usoGoogle, registrarUsoGoogle, LIMITE_MENSAL_PADRAO } = await import("@/services/cota-google");
    const { zerarDados } = await import("@/services/zerar");
    const outubro = new Date("2026-10-15T12:00:00Z");
    const novembro = new Date("2026-11-01T00:30:00Z");

    assert.deepEqual(await usoGoogle(banco, outubro), { usadas: 0, limite: LIMITE_MENSAL_PADRAO, restantes: LIMITE_MENSAL_PADRAO });
    await registrarUsoGoogle(banco, 3, outubro);
    await registrarUsoGoogle(banco, 10, outubro);
    assert.equal((await usoGoogle(banco, outubro)).usadas, 13);
    assert.equal((await usoGoogle(banco, novembro)).usadas, 0, "mês novo começa do zero");

    await banco.execute(`INSERT INTO configuracoes (chave, valor) VALUES ('google_limite_mensal', '15')`);
    assert.deepEqual(await usoGoogle(banco, outubro), { usadas: 13, limite: 15, restantes: 2 });
    await registrarUsoGoogle(banco, 5, outubro);
    assert.equal((await usoGoogle(banco, outubro)).restantes, 0, "nunca negativo");

    await zerarDados(banco, { incluirVendas: true, orcamentoMs: 30_000 });
    assert.equal((await usoGoogle(banco, outubro)).usadas, 18, "apagar as buscas não zera a conta do Google");
  });
});
