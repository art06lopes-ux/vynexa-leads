import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { interpretarConsulta } from "@/services/consulta-natural";

describe("interpretarConsulta", () => {
  it("barbearias sem site em Manacapuru", () => {
    const c = interpretarConsulta("Barbearias sem site em Manacapuru");
    assert.equal(c.termo, "Barbearias");
    assert.equal(c.local, "Manacapuru");
    assert.equal(c.pais, "BR");
    assert.equal(c.site, "sem");
  });

  it("frase longa com avaliações e site", () => {
    const c = interpretarConsulta(
      "Quero empresas de estética automotiva em Miami que não possuem site e tenham mais de 50 avaliações.",
    );
    assert.equal(c.termo, "estética automotiva");
    assert.equal(c.local, "Miami");
    assert.equal(c.pais, "US");
    assert.equal(c.site, "sem");
    assert.equal(c.avaliacoesMin, 50);
  });

  it("inglês com estado americano", () => {
    const c = interpretarConsulta("Auto detailing em California");
    assert.equal(c.termo, "Auto detailing");
    assert.equal(c.local, "California");
    assert.equal(c.pais, "US");
    assert.equal(c.site, "todos");
  });

  it("país inteiro", () => {
    const c = interpretarConsulta("Imobiliárias em Portugal");
    assert.equal(c.termo, "Imobiliárias");
    assert.equal(c.pais, "PT");
  });

  it("'de' dentro do termo não vira local", () => {
    const c = interpretarConsulta("Clínica de estética em Manaus com WhatsApp");
    assert.equal(c.termo, "Clínica de estética");
    assert.equal(c.local, "Manaus");
    assert.equal(c.comWhatsapp, true);
  });

  it("qualquer lugar", () => {
    const c = interpretarConsulta("Barbearias em qualquer lugar");
    assert.equal(c.termo, "Barbearias");
    assert.equal(c.local, null);
    assert.equal(c.pais, null);
  });

  it("inglês: dentists without website in Dublin, Ireland", () => {
    const c = interpretarConsulta("dentists without a website in Dublin, Ireland");
    assert.equal(c.termo, "dentists");
    assert.equal(c.local, "Dublin, Ireland");
    assert.equal(c.pais, "IE");
    assert.equal(c.site, "sem");
  });

  it("site ruim e nota mínima", () => {
    const c = interpretarConsulta("Restaurantes com site desatualizado em Lisboa nota acima de 4,5");
    assert.equal(c.site, "ruim");
    assert.equal(c.notaMin, 4.5);
    assert.equal(c.pais, "PT");
  });
});

describe("estados do Brasil na frase", () => {
  it("nome ou sigla do estado vira estado, não cidade", () => {
    const sc = interpretarConsulta("energia solar em santa catarina");
    assert.equal(sc.termo, "energia solar");
    assert.equal(sc.pais, "BR");
    assert.equal(sc.uf, "SC");
    assert.equal(sc.cidade, null);
    const sigla = interpretarConsulta("energia solar em SC");
    assert.equal(sigla.uf, "SC");
    assert.equal(sigla.pais, "BR");
    assert.equal(sigla.cidade, null);
  });

  it("cidade com estado separa os dois; cidade sozinha continua cidade", () => {
    const c = interpretarConsulta("energia solar em Joinville, Santa Catarina");
    assert.deepEqual([c.cidade, c.uf], ["Joinville", "SC"]);
    const m = interpretarConsulta("barbearia em Manacapuru, AM");
    assert.deepEqual([m.cidade, m.uf], ["Manacapuru", "AM"]);
    const f = interpretarConsulta("energia solar em Florianópolis");
    assert.deepEqual([f.cidade, f.uf], ["Florianópolis", null]);
    const sp = interpretarConsulta("dentista em São Paulo");
    assert.deepEqual([sp.cidade, sp.uf], ["São Paulo", "SP"], "São Paulo sozinho é a capital");
    const hifen = interpretarConsulta("pet shop em Embu-Guaçu");
    assert.equal(hifen.cidade, "Embu-Guaçu");
  });
});
