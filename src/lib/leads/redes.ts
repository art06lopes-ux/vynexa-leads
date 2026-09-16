/**
 * Endereço clicável de um perfil de rede social.
 *
 * O OpenStreetMap grava `contact:instagram` de três jeitos — URL inteira,
 * "@perfil" ou só "perfil" — e o site da empresa entrega URL. Tudo vira
 * um link; nada é inventado: sem valor, sem link.
 */
export function linkInstagram(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, "").replace(/^instagram\.com\//i, "")}`;
}

export function linkFacebook(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://facebook.com/${v.replace(/^@/, "").replace(/^facebook\.com\//i, "")}`;
}
