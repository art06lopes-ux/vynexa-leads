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
