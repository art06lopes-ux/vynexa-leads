/**
 * Leitura das variáveis de ambiente com falha alta e cedo.
 *
 * Sem `server-only` de propósito: este módulo é importado tanto pelo app
 * na Vercel quanto pelo worker no GitHub Actions, que roda em Node puro.
 * O `server-only` quebraria o segundo. Nenhum valor daqui é exposto ao
 * navegador — quem garante isso é a ausência do prefixo `NEXT_PUBLIC_`.
 */

function obrigatoria(nome: string, valor: string | undefined): string {
  if (valor === undefined || valor.trim() === "") {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. Copie .env.example para .env.local e preencha. Ver docs/SETUP.md.`,
    );
  }
  return valor;
}

/**
 * Identificação enviada à Overpass e ao Nominatim.
 *
 * Ambos exigem um User-Agent que identifique a aplicação e um contato
 * alcançável; o padrão de biblioteca não serve e leva a bloqueio sem
 * aviso. https://operations.osmfoundation.org/policies/nominatim/
 */
export function getOsmUserAgent(): string {
  const contato = process.env.OSM_CONTATO?.trim();
  const base = "VynexaLeads/1.0 (+https://github.com/art06lopes-ux/vynexa-leads)";
  return contato ? `${base} (${contato})` : base;
}

/** Senha única do painel. Ver `src/lib/auth.ts`. */
export function getSenhaPainel(): string {
  return obrigatoria("SENHA_PAINEL", process.env.SENHA_PAINEL);
}

/** Segredo que assina o cookie de sessão. */
export function getSegredoSessao(): string {
  const valor = obrigatoria("SEGREDO_SESSAO", process.env.SEGREDO_SESSAO);
  if (valor.length < 32) {
    throw new Error(
      "SEGREDO_SESSAO precisa ter pelo menos 32 caracteres. Gere um com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return valor;
}
