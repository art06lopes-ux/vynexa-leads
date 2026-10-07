/**
 * Estados do Brasil: sigla ↔ nome. Serve para entender "energia solar em
 * Santa Catarina" (ou "em SC") como ESTADO — sem isto, o nome ia parar
 * no campo de cidade e a busca procurava um povoado chamado "Santa
 * Catarina", com área minúscula e zero resultados.
 */
export const ESTADOS_BR: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

const simplificar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const POR_NOME = new Map(Object.entries(ESTADOS_BR).map(([uf, nome]) => [simplificar(nome), uf]));

/**
 * "Santa Catarina", "santa catarina", "SC", "sc" → "SC". Nulo se não for
 * estado. "São Paulo" e "Rio de Janeiro" também são cidades; quem chama
 * decide (a frase com só o nome do estado vira o estado inteiro).
 */
export function ufDoTexto(texto: string): string | null {
  const t = texto.trim();
  if (/^[A-Za-z]{2}$/.test(t) && ESTADOS_BR[t.toUpperCase()]) return t.toUpperCase();
  return POR_NOME.get(simplificar(t.replace(/^(estado d[eoa]s?)\s+/i, ""))) ?? null;
}

/**
 * Separa "Florianópolis, SC" / "Santa Catarina" / "Joinville, Santa
 * Catarina" em cidade e UF.
 */
export function separarLocalBR(local: string): { cidade: string | null; uf: string | null } {
  // Vírgula, barra ou " - " separam; hífen colado é do nome ("Embu-Guaçu").
  const partes = local.split(/\s*[,/]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  // "São Paulo" e "Rio de Janeiro" sozinhos: quem escreve quase sempre
  // quer a capital, não o estado inteiro.
  if (partes.length === 1 && /^(sao paulo|rio de janeiro)$/.test(simplificar(partes[0]))) {
    return { cidade: partes[0], uf: ufDoTexto(partes[0]) };
  }
  let uf: string | null = null;
  const resto: string[] = [];
  for (const p of partes) {
    const achado: string | null = uf ? null : ufDoTexto(p);
    if (achado) uf = achado;
    else resto.push(p);
  }
  return { cidade: resto[0] ?? null, uf };
}
