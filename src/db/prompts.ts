import { agora, getBanco, novoId, planos } from "@/db/cliente";

/** Prompts salvos do gerador. */

export type PromptSalvo = {
  id: string;
  titulo: string;
  modo: "ideia" | "melhorar";
  formato: "texto" | "json";
  entrada: string;
  saida: string;
  favorito: number;
  criado_em: string;
};

export async function listarPrompts(): Promise<PromptSalvo[]> {
  const { rows } = await getBanco().execute(`SELECT * FROM prompts ORDER BY favorito DESC, criado_em DESC LIMIT 200`);
  return planos<PromptSalvo>(rows).map((p) => ({ ...p, favorito: Number(p.favorito) }));
}

export async function salvarPrompt(p: Omit<PromptSalvo, "id" | "criado_em" | "favorito">): Promise<string> {
  const id = novoId();
  await getBanco().execute({
    sql: `INSERT INTO prompts (id, titulo, modo, formato, entrada, saida, favorito, criado_em) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [id, p.titulo, p.modo, p.formato, p.entrada, p.saida, agora()],
  });
  return id;
}

export async function marcarFavorito(id: string, favorito: boolean): Promise<boolean> {
  const r = await getBanco().execute({ sql: `UPDATE prompts SET favorito = ? WHERE id = ?`, args: [favorito ? 1 : 0, id] });
  return r.rowsAffected > 0;
}

export async function excluirPrompt(id: string): Promise<boolean> {
  const r = await getBanco().execute({ sql: `DELETE FROM prompts WHERE id = ?`, args: [id] });
  return r.rowsAffected > 0;
}
