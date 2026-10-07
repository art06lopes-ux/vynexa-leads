import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import type { Client } from "@libsql/client";

import { bancoDeTeste, lugar } from "@/test/banco";

let banco: Client;

before(async () => {
  banco = await bancoDeTeste();
  process.env.SENHA_PAINEL = "senha-de-teste";
});

async function leadDe(placeId: string): Promise<string> {
  const { rows } = await banco.execute({ sql: `SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE e.place_id = ?`, args: [placeId] });
  return String(rows[0]!.id);
}

describe("autenticação", () => {
  it("sessão assinada vale; adulterada ou vencida não", async () => {
    const { criarValorDeSessao, sessaoValida, senhaCorreta } = await import("@/lib/auth");
    const { valor } = await criarValorDeSessao();
    assert.equal(await sessaoValida(valor), true);
    const [prazo, assinatura] = valor.split(".");
    assert.equal(await sessaoValida(`${Number(prazo) + 1000}.${assinatura}`), false, "prazo estendido à mão");
    assert.equal(await sessaoValida(`${Date.now() - 1000}.${assinatura}`), false, "vencida");
    assert.equal(await sessaoValida(undefined), false);
    assert.equal(senhaCorreta("senha-de-teste"), true);
    assert.equal(senhaCorreta("errada"), false);
  });

  it("rate limit barra depois do máximo", async () => {
    const { limitar } = await import("@/server/erros");
    for (let i = 0; i < 3; i += 1) await limitar("teste-limite", 3, 60);
    await assert.rejects(limitar("teste-limite", 3, 60), /Muitas requisições/);
  });
});

describe("filtros de leads", () => {
  it("site, WhatsApp, score, avaliações e busca textual", async () => {
    const { registrarLugares } = await import("@/services/registro");
    const { listarLeads } = await import("@/db/leads");
    await registrarLugares(
      banco,
      [
        lugar({ externoId: "f1", nome: "Studio Sem Site", telefone: "+55 92 99111-0001", avaliacaoNota: 4.9, avaliacaoQtd: 120 }),
        lugar({ externoId: "f2", nome: "Barbearia Com Site", website: "https://comsite.com.br", avaliacaoNota: 4.0, avaliacaoQtd: 10 }),
        lugar({ externoId: "f3", nome: "Insta Only", instagram: "@insta.only" }),
      ],
      { buscaId: null },
    );
    const nomes = async (f: Parameters<typeof listarLeads>[0]) => (await listarLeads(f)).itens.map((l) => l.nome).sort();
    assert.deepEqual(await nomes({ site: "sem" }), ["Insta Only", "Studio Sem Site"]);
    assert.deepEqual(await nomes({ site: "com" }), ["Barbearia Com Site"]);
    assert.deepEqual(await nomes({ site: "social" }), ["Insta Only"]);
    assert.deepEqual(await nomes({ whatsapp: true }), ["Studio Sem Site"]);
    assert.deepEqual(await nomes({ avaliacoesMin: 100 }), ["Studio Sem Site"]);
    assert.deepEqual(await nomes({ q: "Com Site" }), ["Barbearia Com Site"]);
    assert.deepEqual(await nomes({ q: "99111-0001" }), ["Studio Sem Site"], "busca por telefone");
    const altos = await listarLeads({ scoreMin: 80 });
    assert.ok(altos.itens.every((l) => (l.score_oportunidade ?? 0) >= 80));
  });

  it("valores maliciosos nos filtros não viram SQL", async () => {
    const { listarLeads } = await import("@/db/leads");
    const r = await listarLeads({ q: "'; DROP TABLE empresas; --" });
    assert.equal(r.total, 0);
    const { rows } = await banco.execute(`SELECT COUNT(*) n FROM empresas`);
    assert.ok(Number(rows[0]!.n) > 0);
  });
});

describe("CRM", () => {
  it("mover carimba contato/resposta e registra o histórico", async () => {
    const { mudarEtapa } = await import("@/services/acoes-lead");
    const id = await leadDe("f1");
    await mudarEtapa(banco, id, "negociacao");
    const { rows } = await banco.execute({ sql: `SELECT etapa, contatado_em, respondeu_em FROM leads WHERE id = ?`, args: [id] });
    assert.equal(rows[0]!.etapa, "negociacao");
    assert.ok(rows[0]!.contatado_em);
    assert.ok(rows[0]!.respondeu_em);
    const { rows: ev } = await banco.execute({ sql: `SELECT descricao FROM eventos WHERE lead_id = ? AND tipo = 'etapa_alterada'`, args: [id] });
    assert.equal(ev[0]!.descricao, "Novo → Negociação");
  });

  it("perdido guarda o motivo", async () => {
    const { mudarEtapa } = await import("@/services/acoes-lead");
    const id = await leadDe("f2");
    await mudarEtapa(banco, id, "perdido", "Já tem agência");
    const { rows } = await banco.execute({ sql: `SELECT motivo_perda FROM leads WHERE id = ?`, args: [id] });
    assert.equal(rows[0]!.motivo_perda, "Já tem agência");
  });

  it("abrir o WhatsApp conta como abordagem; copiar não", async () => {
    const { registrarContato } = await import("@/services/acoes-lead");
    const id = await leadDe("f3");
    await registrarContato(banco, id, "mensagem_copiada");
    let { rows } = await banco.execute({ sql: `SELECT etapa FROM leads WHERE id = ?`, args: [id] });
    assert.equal(rows[0]!.etapa, "novo");
    await registrarContato(banco, id, "whatsapp_aberto");
    ({ rows } = await banco.execute({ sql: `SELECT etapa, contatado_em FROM leads WHERE id = ?`, args: [id] }));
    assert.equal(rows[0]!.etapa, "abordado");
    assert.ok(rows[0]!.contatado_em);
  });
});

describe("rastreio", () => {
  it("link assinado: destino trocado não passa", async () => {
    const { assinar, assinaturaConfere, novoToken } = await import("@/services/rastreio");
    const token = novoToken();
    const s = await assinar(token, "https://vynexa.dev");
    assert.equal(await assinaturaConfere(token, "https://vynexa.dev", s), true);
    assert.equal(await assinaturaConfere(token, "https://golpe.example", s), false);
    assert.equal(await assinaturaConfere(novoToken(), "https://vynexa.dev", s), false);
  });

  it("abertura conta uma vez e promove o status", async () => {
    const { registrarAbertura, registrarClique } = await import("@/services/rastreio-eventos");
    const id = await leadDe("f1");
    await banco.execute({ sql: `INSERT INTO envios (id, lead_id, status, token, enviado_em) VALUES ('e-r', ?, 'enviado', 'tokendeteste1234567890', datetime('now'))`, args: [id] });
    await registrarAbertura(banco, "tokendeteste1234567890");
    await registrarAbertura(banco, "tokendeteste1234567890");
    await registrarClique(banco, "tokendeteste1234567890", "https://vynexa.dev");
    const { rows } = await banco.execute(`SELECT status, aberto_em, clicado_em FROM envios WHERE id = 'e-r'`);
    assert.equal(rows[0]!.status, "clicado");
    const { rows: ev } = await banco.execute({ sql: `SELECT COUNT(*) n FROM eventos WHERE lead_id = ? AND tipo = 'email_aberto'`, args: [id] });
    assert.equal(Number(ev[0]!.n), 1);
  });
});

describe("erros", () => {
  it("API devolve mensagem legível, nunca 500 cru", async () => {
    const { respostaDeErro, ErroApi } = await import("@/server/erros");
    const r1 = respostaDeErro(new ErroApi("Campo X inválido.", 422));
    assert.equal(r1.status, 422);
    assert.equal(((await r1.json()) as { erro: string }).erro, "Campo X inválido.");
    const r2 = respostaDeErro(Object.assign(new Error("A IA não está configurada."), { semConfiguracao: true }));
    assert.equal(r2.status, 409);
    assert.equal(((await r2.json()) as { codigo: string }).codigo, "sem_configuracao");
    const longa = respostaDeErro(new Error("x".repeat(500)));
    assert.match(((await longa.json()) as { erro: string }).erro, /Não conseguimos concluir/);
  });

  it("busca sem chave do Google falha com erro de configuração e marca a busca", async () => {
    const { executarAgora } = await import("@/worker/fila");
    await banco.execute(`INSERT INTO buscas (id, segmento, pais, provedor, status) VALUES ('b-erro', 'barbearia', 'BR', 'google_places', 'pendente')`);
    await banco.execute(`INSERT INTO jobs (id, tipo, payload, status) VALUES ('j-erro', 'busca_google', '{"buscaId":"b-erro"}', 'pendente')`);
    await executarAgora(banco, "j-erro");
    const { rows } = await banco.execute(`SELECT status, erro FROM buscas WHERE id = 'b-erro'`);
    assert.equal(rows[0]!.status, "erro");
    assert.match(String(rows[0]!.erro), /Configurações/);
    const { rows: j } = await banco.execute(`SELECT status FROM jobs WHERE id = 'j-erro'`);
    assert.equal(j[0]!.status, "erro", "falta de configuração não fica tentando");
  });
});
