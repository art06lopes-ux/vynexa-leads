import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { classificarStatusSite, ehAlimentacao, ehCardapioOnline, paginaDeCardapio } from "@/lib/leads/classificacao";
import { dominioProprio } from "@/services/normalizacao";

const base = { telefone: "92999999999" };

describe("cardápio de plataforma não é site (só em alimentação)", () => {
  it("reconhece as plataformas, inclusive subdomínio e link sem esquema", () => {
    for (const u of [
      "https://pedido.anota.ai/loja/burger-x",
      "https://hamburgueria294.brendi.com.br",
      "goomer.app/burger-x",
      "https://www.ifood.com.br/delivery/manacapuru-am/burger-x/abc",
      "https://cardapioweb.com/burgerx",
      "https://burgerx.menudino.com",
    ]) {
      assert.equal(ehCardapioOnline(u), true, u);
    }
    assert.equal(ehCardapioOnline("https://burgerx.com.br"), false);
    assert.equal(ehCardapioOnline(null), false);
  });

  it("restaurante e hamburgueria com só cardápio contam como sem site próprio", () => {
    assert.equal(classificarStatusSite({ ...base, website: "https://pedido.anota.ai/loja/x", categoria: "hamburgueria manacapuru Hamburgueria" }), "rede_social");
    assert.equal(classificarStatusSite({ ...base, website: "https://www.ifood.com.br/delivery/x", categoria: "restaurante Restaurante" }), "rede_social");
    assert.equal(classificarStatusSite({ ...base, website: "https://x.brendi.com.br", categoria: "Açaí" }), "rede_social");
    assert.equal(classificarStatusSite({ ...base, website: "https://burgerx.com.br", categoria: "Hamburgueria" }), "tem_site", "site próprio continua site");
  });

  it("fora de alimentação, o link continua contando como site", () => {
    assert.equal(classificarStatusSite({ ...base, website: "https://x.kyte.site", categoria: "Loja de roupas" }), "tem_site");
    assert.equal(classificarStatusSite({ ...base, website: "https://pedido.anota.ai/loja/x", categoria: "Barbearia" }), "tem_site");
    assert.equal(classificarStatusSite({ ...base, website: "https://pedido.anota.ai/loja/x" }), "tem_site", "sem categoria, não presume");
  });

  it("detecta alimentação sem pegar barbearia nem academia", () => {
    for (const c of ["Hamburgueria", "Pizzaria", "Restaurante japonês", "Lanchonete", "Açaí", "hamburger_restaurant", "Bar", "Padaria", "Confeitaria"]) assert.equal(ehAlimentacao(c), true, c);
    for (const c of ["Barbearia", "Academia", "Loja de roupas", "Energia solar", null]) assert.equal(ehAlimentacao(c), false, String(c));
  });

  it("cardápio não vira domínio próprio — evita fundir restaurantes do mesmo iFood", () => {
    assert.equal(dominioProprio("https://www.ifood.com.br/delivery/a"), null);
    assert.equal(dominioProprio("https://pedido.anota.ai/loja/b"), null);
    assert.equal(dominioProprio("https://burgerx.com.br"), "burgerx.com.br");
  });

  it("percebe loja de plataforma com domínio próprio, sem confundir com um botão do iFood", () => {
    const loja = `<html><head><link href="https://static.brendi.com.br/app.css" rel="stylesheet"><script src="https://static.brendi.com.br/app.js"></script></head></html>`;
    const site = `<html><body><h1>Burger X</h1><a href="https://www.ifood.com.br/delivery/burger-x">Peça no iFood</a></body></html>`;
    assert.equal(paginaDeCardapio(loja), true);
    assert.equal(paginaDeCardapio(site), false);
  });
});
