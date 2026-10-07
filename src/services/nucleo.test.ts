import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { carimbosDaEtapa, ETAPAS, proximaEtapa } from "@/services/crm";
import { acharDuplicata, deduplicarLote, motivoDeDuplicata, type ChavesEmpresa } from "@/services/duplicatas";
import { crc32, paraCsv, paraJson, paraXlsx, type LinhaExportacao } from "@/services/exportacao";
import { chaveEndereco, chaveNome, dominioProprio } from "@/services/normalizacao";
import { interpretarEventoAsaas, tokenConfere } from "@/services/pagamentos";
import { avaliarSinais, extrairSinaisDoHtml, statusPresenca, type SinaisSite } from "@/services/qualidade-site";
import { calcularScore, type EntradaScore } from "@/services/score";

const base: EntradaScore = {
  status_site: "sem_site",
  site_qualidade: null,
  whatsapp: 1,
  email: "contato@barbearia.com",
  instagram: "@barbeariax",
  avaliacao_nota: 4.8,
  avaliacao_qtd: 247,
  status_negocio: "OPERATIONAL",
  fonte: "google_places",
  categoria: "barbearia",
  categoria_rotulo: "Barbearia",
  telefone: "+55 92 99999-0000",
};

describe("score de oportunidade", () => {
  it("lead completo sem site fica no topo, com os motivos", () => {
    const r = calcularScore(base);
    assert.equal(r.score, 100);
    assert.equal(r.prioridade, "alta");
    const motivos = r.motivos.map((m) => m.motivo);
    assert.ok(motivos.includes("Não possui site"));
    assert.ok(motivos.includes("Possui WhatsApp"));
    assert.ok(motivos.includes("247 avaliações no Google"));
    assert.ok(motivos.some((m) => m.startsWith("Nota 4,8")));
  });

  it("site moderno tira pontos", () => {
    const r = calcularScore({ ...base, status_site: "tem_site", site_qualidade: "excelente" });
    assert.ok(r.score < 70);
    assert.ok(r.motivos.some((m) => m.pontos < 0));
  });

  it("site fraco soma menos que sem site, mais que site bom", () => {
    const fraco = calcularScore({ ...base, status_site: "tem_site", site_qualidade: "fraco" }).score;
    const bom = calcularScore({ ...base, status_site: "tem_site", site_qualidade: "bom" }).score;
    const sem = calcularScore(base).score;
    assert.ok(sem > fraco && fraco > bom);
  });

  it("sem dado não ganha ponto de 'sem site' — ausência de informação não é fato", () => {
    const r = calcularScore({ ...base, status_site: "sem_dado", whatsapp: 0, email: null, instagram: null, avaliacao_nota: null, avaliacao_qtd: null, status_negocio: null });
    assert.ok(!r.motivos.some((m) => m.motivo === "Não possui site"));
    assert.equal(r.prioridade, "baixa");
  });

  it("fechada permanentemente zera", () => {
    assert.equal(calcularScore({ ...base, status_negocio: "CLOSED_PERMANENTLY" }).score, 0);
  });

  it("avaliação ausente não dá nem tira ponto", () => {
    const sem = calcularScore({ ...base, avaliacao_nota: null, avaliacao_qtd: null });
    assert.ok(!sem.motivos.some((m) => /avalia|Nota/.test(m.motivo)));
  });
});

describe("duplicatas", () => {
  const vazio: ChavesEmpresa = { place_id: null, osm_id: null, cnpj: null, telefone_e164: null, dominio: null, nome_chave: null, endereco_chave: null, cidade: null };

  it("place_id, telefone, domínio e nome+endereço", () => {
    assert.equal(motivoDeDuplicata({ ...vazio, place_id: "a" }, { ...vazio, place_id: "a" }), "place_id");
    assert.equal(motivoDeDuplicata({ ...vazio, telefone_e164: "5592999990000" }, { ...vazio, telefone_e164: "5592999990000" }), "telefone");
    assert.equal(motivoDeDuplicata({ ...vazio, dominio: "barbeariax.com.br" }, { ...vazio, dominio: "barbeariax.com.br" }), "dominio");
    const a = { ...vazio, nome_chave: chaveNome("Barbearia do Zé LTDA"), endereco_chave: chaveEndereco("R. Sete de Setembro, 120 - Centro"), cidade: "Manaus" };
    const b = { ...vazio, nome_chave: chaveNome("BARBEARIA DO ZE"), endereco_chave: chaveEndereco("Rua Sete de Setembro 120"), cidade: "manaus" };
    assert.equal(motivoDeDuplicata(a, b), "nome_endereco");
  });

  it("mesmo nome em cidades diferentes não é duplicata", () => {
    const a = { ...vazio, nome_chave: "barbearia do ze", endereco_chave: "rua 1 120", cidade: "Manaus" };
    const b = { ...vazio, nome_chave: "barbearia do ze", endereco_chave: "rua 1 120", cidade: "Belém" };
    assert.equal(motivoDeDuplicata(a, b), null);
  });

  it("nulos nunca casam", () => {
    assert.equal(motivoDeDuplicata(vazio, vazio), null);
  });

  it("endereço sem número não identifica", () => {
    assert.equal(chaveEndereco("Centro"), null);
  });

  it("perfil de Instagram não é domínio próprio", () => {
    assert.equal(dominioProprio("https://instagram.com/barbeariax"), null);
    assert.equal(dominioProprio("www.barbeariax.com.br"), "barbeariax.com.br");
  });

  it("dedup dentro do lote mantém a primeira", () => {
    const { unicos, repetidos } = deduplicarLote([
      { ...vazio, place_id: "1" },
      { ...vazio, place_id: "1" },
      { ...vazio, place_id: "2", telefone_e164: "551199" },
      { ...vazio, place_id: "3", telefone_e164: "551199" },
    ]);
    assert.equal(unicos.length, 2);
    assert.equal(repetidos, 2);
    assert.ok(acharDuplicata({ ...vazio, place_id: "2" }, unicos));
  });
});

describe("qualidade do site", () => {
  const bom: SinaisSite = {
    ok: true, statusHttp: 200, https: true, tempoMs: 900, viewport: true, doctypeHtml5: true, anoCopyright: new Date().getFullYear(),
    gerador: null, flash: false, jqueryAntigo: false, layoutEmTabela: false, titulo: "Barbearia", temDescricao: true,
    temOpenGraph: true, temLinkWhatsapp: true, tamanhoKb: 80, redirecionouPara: null,
  };

  it("site moderno é excelente", () => {
    assert.equal(avaliarSinais(bom).qualidade, "excelente");
  });

  it("sem viewport, sem https e rodapé antigo é fraco", () => {
    const a = avaliarSinais({ ...bom, https: false, viewport: false, anoCopyright: 2016 }, 2026);
    assert.equal(a.qualidade, "fraco");
    assert.ok(a.problemas.includes("Não se adapta ao celular"));
  });

  it("fora do ar", () => {
    assert.equal(avaliarSinais({ ...bom, ok: false, statusHttp: 503 }).qualidade, "fora_do_ar");
  });

  it("extrai sinais do HTML", () => {
    const s = extrairSinaisDoHtml(`<!DOCTYPE html><html><head><title>X</title><meta name="viewport" content="width=device-width">
      <script src="/js/jquery-1.8.3.min.js"></script></head><body>© 2015 X <a href="https://wa.me/5592">zap</a></body></html>`);
    assert.equal(s.viewport, true);
    assert.equal(s.jqueryAntigo, true);
    assert.equal(s.anoCopyright, 2015);
    assert.equal(s.temLinkWhatsapp, true);
  });

  it("presença combina status da fonte e nota da visita", () => {
    assert.equal(statusPresenca("tem_site", null), "nao_avaliado");
    assert.equal(statusPresenca("tem_site", "fraco"), "fraco");
    assert.equal(statusPresenca("rede_social", null), "rede_social");
  });
});

describe("CRM", () => {
  it("oito etapas na ordem da especificação", () => {
    assert.deepEqual(ETAPAS, ["novo", "qualificado", "abordado", "respondeu", "negociacao", "proposta", "fechado", "perdido"]);
  });
  it("carimbos e próxima etapa", () => {
    assert.deepEqual(carimbosDaEtapa("novo"), []);
    assert.deepEqual(carimbosDaEtapa("abordado"), ["contatado_em"]);
    assert.deepEqual(carimbosDaEtapa("proposta"), ["contatado_em", "respondeu_em"]);
    assert.deepEqual(carimbosDaEtapa("perdido"), []);
    assert.equal(proximaEtapa("proposta"), "fechado");
    assert.equal(proximaEtapa("fechado"), null);
  });
});

describe("exportação", () => {
  const linhas: LinhaExportacao[] = [
    {
      nome: 'Barbearia "X"', categoria: "Barbearia", endereco: "Rua 1, 10", cidade: "Manacapuru", pais: "BR", telefone: "+55 92 99999-0000",
      whatsapp: "5592999990000", email: null, website: null, instagram: "@x", google_maps: "https://maps.google.com/?cid=1",
      avaliacao_nota: 4.8, avaliacao_qtd: 247, score: 87, status: "Sem site", etapa: "Novo", fonte: "Google Maps", descoberto_em: "2026-10-06",
    },
  ];

  it("CSV escapa aspas e tem o cabeçalho pedido", () => {
    const csv = paraCsv(linhas);
    assert.ok(csv.includes("Nome"));
    assert.ok(csv.includes('"Barbearia ""X"""'));
  });

  it("JSON preserva números e nulos", () => {
    const [l] = JSON.parse(paraJson(linhas)) as LinhaExportacao[];
    assert.equal(l.score, 87);
    assert.equal(l.email, null);
  });

  it("XLSX é um zip válido com a planilha", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    const xlsx = paraXlsx(linhas);
    assert.equal(xlsx[0], 0x50); // "PK"
    assert.equal(xlsx[1], 0x4b);
    const pasta = mkdtempSync(join(tmpdir(), "xlsx-"));
    const arquivo = join(pasta, "leads.xlsx");
    writeFileSync(arquivo, xlsx);
    // O próprio unzip valida CRC e estrutura.
    try {
      const lista = execFileSync("unzip", ["-l", arquivo]).toString();
      assert.ok(lista.includes("xl/worksheets/sheet1.xml"));
      const planilha = execFileSync("unzip", ["-p", arquivo, "xl/worksheets/sheet1.xml"]).toString();
      assert.ok(planilha.includes("Barbearia &quot;X&quot;"));
    } catch (erro) {
      if ((erro as { code?: string }).code !== "ENOENT") throw erro; // sem unzip na máquina
    }
  });
});

describe("eventos do Asaas", () => {
  it("confirmado e recebido pagam e comemoram", () => {
    assert.equal(interpretarEventoAsaas({ event: "PAYMENT_CONFIRMED" })?.pago, true);
    assert.equal(interpretarEventoAsaas({ event: "PAYMENT_RECEIVED" })?.comemorar, true);
  });
  it("vencido e cancelado não pagam", () => {
    assert.equal(interpretarEventoAsaas({ event: "PAYMENT_OVERDUE" })?.statusVenda, "vencido");
    assert.equal(interpretarEventoAsaas({ event: "PAYMENT_DELETED" })?.statusCobranca, "cancelado");
  });
  it("evento desconhecido é ignorado", () => {
    assert.equal(interpretarEventoAsaas({ event: "ALGO_NOVO" }), null);
  });
  it("token do webhook em tempo constante", () => {
    assert.equal(tokenConfere("abc123", "abc123"), true);
    assert.equal(tokenConfere("abc123", "abc124"), false);
    assert.equal(tokenConfere(null, "x"), false);
  });
});
