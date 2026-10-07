/**
 * Montagem do e-mail final: corpo da IA + assinatura da Vynexa + logo +
 * rodapé de descadastro, em texto puro e em HTML.
 *
 * Puro: recebe tudo pronto (inclusive as URLs de rastreio, já assinadas)
 * e devolve as duas versões. O HTML é deliberadamente simples — parece
 * um e-mail escrito por uma pessoa, não um boletim de marketing.
 */

export type Identidade = {
  empresaNome: string;
  responsavelNome: string;
  assinatura: string | null;
  site: string | null;
  whatsapp: string | null;
  instagram: string | null;
  logoUrl: string | null;
  corPrimaria: string;
};

export type Rastreio = {
  /** URL do pixel de abertura. Nulo = sem rastreio de abertura. */
  pixel: string | null;
  /** Transforma um link em link rastreado. */
  rastrearLink: ((url: string) => string) | null;
  descadastro: string;
};

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function assinaturaTexto(i: Identidade): string {
  if (i.assinatura?.trim()) return i.assinatura.trim();
  const linhas = [`${i.responsavelNome} · ${i.empresaNome}`];
  if (i.site) linhas.push(i.site);
  if (i.whatsapp) linhas.push(`WhatsApp: ${i.whatsapp}`);
  return linhas.join("\n");
}

/** Linkifica URLs de um trecho já escapado. */
function linkificar(html: string, rastrear: ((url: string) => string) | null): string {
  return html.replace(/https?:\/\/[^\s<>"']+/g, (url) => {
    const destino = url.replace(/&amp;/g, "&");
    const href = rastrear ? rastrear(destino) : destino;
    return `<a href="${escaparHtml(href)}" style="color:#2563eb">${url}</a>`;
  });
}

export function comporEmail(corpo: string, identidade: Identidade, rastreio: Rastreio, idioma: string): { texto: string; html: string } {
  const assinatura = assinaturaTexto(identidade);
  const rodapeTexto =
    idioma.startsWith("pt")
      ? `Se preferir não receber mais mensagens, é só responder "não" ou acessar: ${rastreio.descadastro}`
      : idioma === "es"
        ? `Si prefiere no recibir más mensajes, responda "no" o acceda a: ${rastreio.descadastro}`
        : `If you'd rather not hear from us again, reply "no" or visit: ${rastreio.descadastro}`;

  const texto = `${corpo.trim()}\n\n${assinatura}\n\n—\n${rodapeTexto}`;

  const paragrafos = corpo
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkificar(escaparHtml(p), rastreio.rastrearLink).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const assinaturaHtml = linkificar(escaparHtml(assinatura), rastreio.rastrearLink).replace(/\n/g, "<br>");
  const logo = identidade.logoUrl
    ? `<img src="${escaparHtml(identidade.logoUrl)}" alt="${escaparHtml(identidade.empresaNome)}" height="28" style="display:block;height:28px;margin:0 0 8px">`
    : "";
  const descadastroTexto = idioma.startsWith("pt") ? "Não quero receber mais mensagens" : idioma === "es" ? "No quiero recibir más mensajes" : "Unsubscribe";

  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111827;background:#ffffff">
<div style="max-width:560px">
${paragrafos}
<div style="margin-top:22px;padding-top:14px;border-top:2px solid ${escaparHtml(identidade.corPrimaria)}">${logo}<div style="font-size:13px;color:#374151">${assinaturaHtml}</div></div>
<p style="margin:26px 0 0;font-size:11px;color:#9ca3af"><a href="${escaparHtml(rastreio.descadastro)}" style="color:#9ca3af">${descadastroTexto}</a></p>
</div>${rastreio.pixel ? `<img src="${escaparHtml(rastreio.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ""}
</body></html>`;

  return { texto, html };
}
