import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { expandirLinkCurto, interpretarLinkMaps, pareceLinkMaps, raioDoZoom } from "./link-maps";

describe("link do Google Maps", () => {
  it("lê o texto pesquisado e o centro do mapa", () => {
    const l = interpretarLinkMaps("https://www.google.com/maps/search/hamburguerias+manacapuru/@-3.2880302,-60.6277183,15z?entry=s&sa=X&ved=1t%3A199789");
    assert.equal(l?.consulta, "hamburguerias manacapuru");
    assert.deepEqual(l?.centro, { lat: -3.2880302, lng: -60.6277183 });
    assert.ok(l!.raioKm! > 2 && l!.raioKm! < 4, `raio ${l?.raioKm}`);
  });

  it("acentos codificados, domínio .com.br e link sem coordenadas", () => {
    assert.equal(interpretarLinkMaps("https://www.google.com.br/maps/search/est%C3%A9tica+automotiva+em+manaus")?.consulta, "estética automotiva em manaus");
    assert.equal(interpretarLinkMaps("https://www.google.com.br/maps/search/est%C3%A9tica+automotiva+em+manaus")?.centro, null);
    assert.equal(interpretarLinkMaps("https://www.google.com/maps/search/?api=1&query=barbearia+lisboa")?.consulta, "barbearia lisboa");
  });

  it("recusa o que não é pesquisa do Maps", () => {
    assert.equal(interpretarLinkMaps("https://www.google.com/search?q=barbearia"), null);
    assert.equal(interpretarLinkMaps("https://golpe.example/maps/search/x/@1,2,15z"), null);
    assert.equal(interpretarLinkMaps("barbearia em manaus"), null);
    assert.equal(pareceLinkMaps("https://maps.app.goo.gl/AbC123"), true);
    assert.equal(pareceLinkMaps("https://goo.gl/outra-coisa"), false);
  });

  it("zoom maior → raio menor, sempre entre 1 e 50 km", () => {
    assert.ok(raioDoZoom(12, 0) > raioDoZoom(15, 0));
    assert.equal(raioDoZoom(3, 0), 50);
    assert.equal(raioDoZoom(20, 0), 1);
  });

  it("link curto: segue o redirecionamento e só aceita destino no Maps", async () => {
    const para = (destino: string) => (async () => new Response(null, { status: 302, headers: { location: destino } })) as unknown as typeof fetch;
    assert.equal(
      await expandirLinkCurto("https://maps.app.goo.gl/AbC123", para("https://www.google.com/maps/search/pizzaria+manacapuru/@-3.29,-60.62,14z")),
      "https://www.google.com/maps/search/pizzaria+manacapuru/@-3.29,-60.62,14z",
    );
    assert.equal(await expandirLinkCurto("https://maps.app.goo.gl/AbC123", para("https://golpe.example/")), null);
  });
});
