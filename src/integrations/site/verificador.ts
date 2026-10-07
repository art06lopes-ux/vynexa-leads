import { getOsmUserAgent } from "@/lib/ambiente";
import { ehRedeSocial } from "@/lib/leads/classificacao";
import { extrairSinaisDoHtml, type SinaisSite } from "@/services/qualidade-site";
import { robotsPermite } from "@/worker/handlers/enriquecer-email";

/**
 * Visita a página inicial de um site e mede os sinais de qualidade.
 *
 * Uma requisição à home (mais o robots.txt), com identificação no
 * User-Agent e timeout curto — o mesmo que um navegador faria ao abrir o
 * site uma vez. Se o robots.txt fechar o site para robôs, não entramos:
 * o resultado é "ok, mas não avaliado por dentro" e os sinais de HTML
 * ficam neutros.
 */

const TIMEOUT_MS = 12_000;

export async function verificarSite(website: string): Promise<SinaisSite & { bloqueadoPorRobots: boolean }> {
  const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  const vazio = {
    viewport: false,
    doctypeHtml5: false,
    anoCopyright: null,
    gerador: null,
    flash: false,
    jqueryAntigo: false,
    layoutEmTabela: false,
    titulo: null,
    temDescricao: false,
    temOpenGraph: false,
    temLinkWhatsapp: false,
    tamanhoKb: null,
  };

  const tentar = async (alvo: URL) => {
    const inicio = Date.now();
    const r = await fetch(alvo, {
      headers: { "User-Agent": getOsmUserAgent(), Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { r, ms: Date.now() - inicio };
  };

  let resposta: { r: Response; ms: number };
  try {
    resposta = await tentar(url);
  } catch {
    // HTTPS falhou (certificado, porta fechada): tenta HTTP antes de dizer "fora do ar".
    if (url.protocol === "https:") {
      try {
        const http = new URL(url);
        http.protocol = "http:";
        resposta = await tentar(http);
      } catch {
        return { ...vazio, ok: false, statusHttp: null, https: false, tempoMs: null, redirecionouPara: null, bloqueadoPorRobots: false };
      }
    } else {
      return { ...vazio, ok: false, statusHttp: null, https: false, tempoMs: null, redirecionouPara: null, bloqueadoPorRobots: false };
    }
  }

  const final = new URL(resposta.r.url || url.href);
  const https = final.protocol === "https:";
  const redirecionouPara = final.hostname.replace(/^www\./, "") !== url.hostname.replace(/^www\./, "") ? final.href : null;
  const base = { ok: resposta.r.ok, statusHttp: resposta.r.status, https, tempoMs: resposta.ms, redirecionouPara };

  if (!resposta.r.ok) return { ...vazio, ...base, bloqueadoPorRobots: false };
  // O domínio próprio redireciona para o Instagram: na prática, não há site.
  if (redirecionouPara && ehRedeSocial(redirecionouPara)) return { ...vazio, ...base, ok: false, bloqueadoPorRobots: false };

  if (!(await robotsPermite(final))) {
    await resposta.r.body?.cancel().catch(() => {});
    return { ...vazio, ...base, viewport: true, doctypeHtml5: true, titulo: "(não avaliado)", temDescricao: true, bloqueadoPorRobots: true };
  }

  const tipo = resposta.r.headers.get("content-type") ?? "";
  if (!tipo.includes("text/html")) return { ...vazio, ...base, bloqueadoPorRobots: false };
  const html = (await resposta.r.text()).slice(0, 1_500_000);
  return { ...base, ...extrairSinaisDoHtml(html), bloqueadoPorRobots: false };
}
