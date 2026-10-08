/**
 * O nicho para mostrar: o termo pesquisado ("energia solar"), sem o nome
 * da cidade que buscas coladas do Maps gravavam junto. O rótulo do Google
 * ("Serviços", "Escritório da empresa") é genérico demais para isso.
 */
export function nichoDe(categoria: string | null | undefined, cidade?: string | null): string {
  let n = (categoria ?? "").toLowerCase();
  if (cidade) n = n.replace(cidade.toLowerCase(), "");
  n = n.replace(/\s+/g, " ").trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}
