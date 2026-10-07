import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { SaidaInvalida, validarTexto } from "@/integrations/ai/agentes/contexto";
import { validarEmailGerado } from "@/integrations/ai/agentes/email-generator";
import { validarMensagens } from "@/integrations/ai/agentes/message-generator";
import { validarOportunidade } from "@/integrations/ai/agentes/sales-opportunity-analyzer";
import { converterCsv, lerCsv } from "@/integrations/leads/csv";
import { converterLugar, GooglePlacesProvider, quadrantes, retanguloDoCirculo } from "@/integrations/leads/google-places";
import { documentoValido } from "@/integrations/pagamentos/asaas";
import { comporEmail } from "@/services/composicao-email";

describe("validação da saída da IA", () => {
  const numeros = new Set(["4.8", "4,8", "247"]);

  it("rejeita número que não está nos dados", () => {
    assert.throws(() => validarTexto("Vi que vocês têm 300 avaliações!", { numeros, campo: "x" }), SaidaInvalida);
    assert.throws(() => validarTexto("Nota 4,9 no Google, parabéns pela reputação", { numeros, campo: "x" }), SaidaInvalida);
  });

  it("aceita os números reais", () => {
    assert.ok(validarTexto("Vi as 247 avaliações e a nota 4,8 no Google.", { numeros, campo: "x" }));
  });

  it("rejeita placeholder e saudação ao remetente", () => {
    assert.throws(() => validarTexto("Olá {nome_empresa}, tudo bem? Encontrei vocês no Google.", { numeros, campo: "x" }), SaidaInvalida);
    assert.throws(() => validarTexto("Olá, Artur! Encontrei vocês no Google e reparei numa coisa.", { numeros, campo: "x", remetente: "Artur" }), SaidaInvalida);
  });

  it("e-mail: assunto com quebra de linha é injeção de cabeçalho", () => {
    assert.throws(() => validarEmailGerado({ assunto: "Oi\nBcc: x@y.com", corpo: "x".repeat(80) }, numeros, "Artur"), SaidaInvalida);
  });

  it("mensagens: todas as versões precisam existir", () => {
    assert.throws(() => validarMensagens({ curta: "Olá, tudo bem com a Barbearia X?" }, numeros, "Artur"));
  });

  it("produto inventado vira nenhum produto", () => {
    const o = validarOportunidade(
      { solucao: "site", produto_id: "nao-existe", argumento: "Um site com botão de WhatsApp aproveita a boa reputação.", cta: "Posso te mostrar uma prévia?", justificativa: "Falta site próprio." },
      numeros,
      [{ id: "p1", nome: "Site Profissional", tipo: "site", descricao: null, preco_centavos: 35000, moeda: "BRL" }],
    );
    assert.equal(o.produtoId, null);
  });
});

describe("Google Places", () => {
  const lugarGoogle = {
    id: "ChIJ123",
    displayName: { text: "Barbearia X" },
    formattedAddress: "R. Sete, 120 - Centro, Manacapuru - AM, 69400-000, Brasil",
    addressComponents: [
      { longText: "Manacapuru", shortText: "Manacapuru", types: ["administrative_area_level_2", "political"] },
      { longText: "Amazonas", shortText: "AM", types: ["administrative_area_level_1"] },
      { longText: "Brasil", shortText: "BR", types: ["country"] },
      { longText: "Centro", types: ["sublocality_level_1"] },
    ],
    location: { latitude: -3.29, longitude: -60.62 },
    primaryTypeDisplayName: { text: "Barbearia" },
    internationalPhoneNumber: "+55 92 99111-2222",
    rating: 4.8,
    userRatingCount: 247,
    businessStatus: "OPERATIONAL",
    googleMapsUri: "https://maps.google.com/?cid=1",
  };

  it("converte o lugar sem inventar e-mail nem site", () => {
    const l = converterLugar(lugarGoogle, "barbearia", "BR")!;
    assert.equal(l.fonte, "google_places");
    assert.equal(l.externoId, "ChIJ123");
    assert.equal(l.pais, "BR");
    assert.equal(l.estado, "AM");
    assert.equal(l.cidade, "Manacapuru");
    assert.equal(l.bairro, "Centro");
    assert.equal(l.email, null);
    assert.equal(l.website, null);
    assert.equal(l.avaliacaoQtd, 247);
    assert.equal(l.fonteUrl, "https://maps.google.com/?cid=1");
  });

  it("geometria: quadrantes e círculo", () => {
    const q = quadrantes({ sul: 0, oeste: 0, norte: 2, leste: 2 });
    assert.equal(q.length, 4);
    assert.deepEqual(q[3], { sul: 1, oeste: 1, norte: 2, leste: 2 });
    const r = retanguloDoCirculo(0, 0, 111.32);
    assert.ok(Math.abs(r.norte - 1) < 1e-9);
  });

  it("pagina até 3 páginas, respeita o teto e sem chave dá erro de configuração", async () => {
    const { bancoDeTeste } = await import("@/test/banco");
    await bancoDeTeste();
    const { salvarSegredo } = await import("@/integrations/segredos");

    const sem = new GooglePlacesProvider(async () => new Response("{}"));
    await assert.rejects(
      sem.buscar({ termo: "barbearia", pais: "BR", estado: null, cidade: null, bairro: null, cep: null, local: "Manacapuru", centro: null, raioKm: null, retangulo: null, idioma: "pt", maxRequisicoes: 5 }),
      (e: Error & { semConfiguracao?: boolean }) => e.semConfiguracao === true,
    );

    await salvarSegredo("GOOGLE_PLACES_API_KEY", "chave-de-teste-1234");
    const chamadas: Array<Record<string, unknown>> = [];
    const falso = (async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
      chamadas.push(corpo);
      const pagina = chamadas.length;
      return new Response(
        JSON.stringify({
          places: Array.from({ length: 20 }, (_, i) => ({ ...lugarGoogle, id: `p${pagina}-${i}`, displayName: { text: `Empresa ${pagina}-${i}` } })),
          nextPageToken: pagina < 3 ? `t${pagina}` : undefined,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const p = new GooglePlacesProvider(falso);
    const r = await p.buscar({ termo: "barbearia", pais: "BR", estado: null, cidade: null, bairro: null, cep: null, local: "Manacapuru", centro: null, raioKm: null, retangulo: null, idioma: "pt", maxRequisicoes: 2 });
    assert.equal(r.requisicoes, 2, "parou no teto");
    assert.equal(r.lugares.length, 40);
    assert.ok(r.aviso);
    assert.equal(chamadas[0].textQuery, "barbearia em Manacapuru");
    assert.equal(chamadas[1].pageToken, "t1");
  });

  it("link do Maps: mesmo texto, centro como preferência (não restrição)", async () => {
    const chamadas: Array<Record<string, unknown>> = [];
    const falso = (async (_url: string, init: RequestInit) => {
      chamadas.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ places: [lugarGoogle] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new GooglePlacesProvider(falso);
    const r = await p.buscar({
      termo: "hamburguerias manacapuru", pais: null, estado: null, cidade: null, bairro: null, cep: null, local: null, centro: null, raioKm: null,
      retangulo: null, idioma: "pt", maxRequisicoes: 5,
      linkMaps: { consulta: "hamburguerias manacapuru", centro: { lat: -3.288, lng: -60.627 }, raioKm: 2.9 },
    });
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].textQuery, "hamburguerias manacapuru");
    assert.equal(chamadas[0].locationRestriction, undefined);
    assert.deepEqual(chamadas[0].locationBias, { circle: { center: { latitude: -3.288, longitude: -60.627 }, radius: 2900 } });
    assert.equal(r.lugares.length, 1);
  });

  it("chave recusada vira erro claro de configuração", async () => {
    const p = new GooglePlacesProvider((async () => new Response(JSON.stringify({ error: { message: "API key not valid", status: "PERMISSION_DENIED" } }), { status: 403 })) as unknown as typeof fetch);
    await assert.rejects(
      p.buscar({ termo: "x", pais: null, estado: null, cidade: null, bairro: null, cep: null, local: "Lisboa", centro: null, raioKm: null, retangulo: null, idioma: "pt", maxRequisicoes: 1 }),
      /recusada/,
    );
  });
});

describe("importação CSV", () => {
  it("lê ponto e vírgula, aspas e cabeçalho em português", () => {
    const linhas = lerCsv('nome;telefone;cidade\n"Barbearia ""X""";(92) 99111-2222;Manacapuru\n');
    assert.deepEqual(linhas[1], ['Barbearia "X"', "(92) 99111-2222", "Manacapuru"]);
  });

  it("converte e ignora linha sem nome; não completa colunas ausentes", () => {
    const r = converterCsv("Name,Phone,City,Country\nJoe's Plumbing,+1 407 555 0134,Orlando,United States\n,123,,\n", { pais: null, categoria: "plumber" });
    assert.equal(r.lugares.length, 1);
    assert.equal(r.ignoradas, 1);
    assert.equal(r.lugares[0].pais, "US");
    assert.equal(r.lugares[0].email, null);
    assert.equal(r.lugares[0].categoria, "plumber");
  });

  it("exige coluna de nome", () => {
    assert.throws(() => converterCsv("telefone\n123\n", { pais: "BR", categoria: "x" }), /nome/);
  });
});

describe("Asaas", () => {
  it("valida CPF e CNPJ", () => {
    assert.equal(documentoValido("529.982.247-25"), true);
    assert.equal(documentoValido("111.111.111-11"), false);
    assert.equal(documentoValido("11.222.333/0001-81"), true);
    assert.equal(documentoValido("11.222.333/0001-80"), false);
  });
});

describe("composição do e-mail", () => {
  it("assinatura, descadastro, pixel e escape de HTML", () => {
    const { texto, html } = comporEmail(
      "Olá, equipe <da> X.\n\nVeja https://vynexa.dev",
      { empresaNome: "Vynexa Dev", responsavelNome: "Artur", assinatura: null, site: "https://vynexa.dev", whatsapp: null, instagram: null, logoUrl: null, corPrimaria: "#2f6bff" },
      { pixel: "https://app/api/t/a/tok", descadastro: "https://app/descadastro/tok", rastrearLink: (u) => `https://app/api/t/c/tok?u=${encodeURIComponent(u)}` },
      "pt-BR",
    );
    assert.ok(texto.includes("Artur · Vynexa Dev"));
    assert.ok(texto.includes("https://app/descadastro/tok"));
    assert.ok(html.includes("&lt;da&gt;"));
    assert.ok(html.includes("/api/t/c/tok?u="));
    assert.ok(html.includes('src="https://app/api/t/a/tok"'));
  });
});

describe("proposta fala pela empresa", () => {
  it("troca a primeira pessoa do singular pela do plural", async () => {
    const { falarComoEmpresa } = await import("@/integrations/ai/agentes/proposal-generator");
    assert.equal(falarComoEmpresa("Atualmente, não encontrei um site. Notei que usa o Instagram."), "Atualmente, não encontramos um site. Notamos que usa o Instagram.");
    assert.equal(falarComoEmpresa("Visita e vitrine continuam iguais."), "Visita e vitrine continuam iguais.", "não mexe em palavras que só começam igual");
  });
});

describe("Google Places: área que não acha nada", () => {
  it("tenta uma vez só pelo texto, sem restrição de área", async () => {
    const { GooglePlacesProvider } = await import("@/integrations/leads/google-places");
    const chamadas: Array<Record<string, unknown>> = [];
    const falso = (async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
      chamadas.push(corpo);
      const lugares = corpo.locationRestriction ? [] : [{ id: "pz", displayName: { text: "Solar SC" }, addressComponents: [{ shortText: "BR", types: ["country"] }] }];
      return new Response(JSON.stringify({ places: lugares }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new GooglePlacesProvider(falso).buscar({
      termo: "energia solar", pais: "BR", estado: "SC", cidade: null, bairro: null, cep: null, local: null, centro: null, raioKm: null,
      retangulo: { sul: -1, oeste: -1, norte: 0, leste: 0 }, idioma: "pt", maxRequisicoes: 5,
    });
    assert.equal(chamadas.length, 2);
    assert.equal(chamadas[1].textQuery, "energia solar em Santa Catarina", "sigla vira nome do estado");
    assert.equal(r.lugares.length, 1);
  });

  it("busca por estado não traz empresa do estado vizinho", async () => {
    const { GooglePlacesProvider } = await import("@/integrations/leads/google-places");
    const lugar = (id: string, uf: string) => ({ id, displayName: { text: id }, addressComponents: [{ shortText: "BR", types: ["country"] }, { shortText: uf, longText: uf, types: ["administrative_area_level_1"] }] });
    const falso = (async () => new Response(JSON.stringify({ places: [lugar("em-sc", "SC"), lugar("em-rs", "RS")] }), { status: 200 })) as unknown as typeof fetch;
    const r = await new GooglePlacesProvider(falso).buscar({
      termo: "energia solar", pais: "BR", estado: "SC", cidade: null, bairro: null, cep: null, local: null, centro: null, raioKm: null,
      retangulo: { sul: -1, oeste: -1, norte: 0, leste: 0 }, idioma: "pt", maxRequisicoes: 1,
    });
    assert.deepEqual(r.lugares.map((l) => l.nome), ["em-sc"]);
  });
});
