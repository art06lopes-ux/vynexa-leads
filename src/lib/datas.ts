/**
 * Datas para a interface. O banco guarda UTC no formato do
 * `datetime('now')` do SQLite ("AAAA-MM-DD HH:MM:SS"); a tela mostra no
 * fuso do operador (Manaus por padrão, configurável).
 */

export const FUSO_PADRAO = "America/Manaus";

export function paraData(sqlite: string | null | undefined): Date | null {
  if (!sqlite) return null;
  const iso = sqlite.includes("T") ? sqlite : `${sqlite.replace(" ", "T")}${sqlite.length > 10 ? "Z" : "T00:00:00Z"}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dataCurta(sqlite: string | null | undefined, fuso = FUSO_PADRAO): string {
  const d = paraData(sqlite);
  return d ? d.toLocaleDateString("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

export function dataHora(sqlite: string | null | undefined, fuso = FUSO_PADRAO): string {
  const d = paraData(sqlite);
  return d
    ? d.toLocaleString("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function saudacao(fuso = FUSO_PADRAO, agora = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "numeric", hour12: false }).format(agora));
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function hojePorExtenso(fuso = FUSO_PADRAO, agora = new Date()): string {
  const t = agora.toLocaleDateString("pt-BR", { timeZone: fuso, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "2026-09" → "Set". */
export function rotuloMes(aaaamm: string): string {
  return MESES[Number(aaaamm.slice(5, 7)) - 1] ?? aaaamm;
}

/** "2026-09-30" → "30/09". */
export function rotuloDia(aaaammdd: string): string {
  return `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}`;
}
