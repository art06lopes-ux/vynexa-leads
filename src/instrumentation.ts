/**
 * Roda uma vez quando o servidor sobe: aplica as atualizações aditivas de
 * banco (src/db/esquema-auto.ts). Só no runtime Node — o proxy (Edge)
 * não fala com o banco.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getBancoPrincipal } = await import("@/db/cliente");
  const { garantirEsquema } = await import("@/db/esquema-auto");
  const aplicadas = await garantirEsquema(getBancoPrincipal());
  if (aplicadas.length > 0) console.log("[esquema-auto] aplicadas:", aplicadas.join(", "));
}
