"use server";

import { revalidatePath } from "next/cache";

import { gravarConfiguracao } from "@/db/configuracoes";
import { exigirSessao } from "@/server/sessao";
import type { EstadoAcao } from "@/server/estado-acao";

/** Só estas chaves podem ser gravadas pela interface. */
const PERMITIDAS = new Set(["empresa_nome", "moeda_padrao", "remetente_nome"]);

export async function salvarAjustes(
  _anterior: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  await exigirSessao();

  for (const [chave, valor] of form.entries()) {
    // Lista de permissão, não de bloqueio: sem ela, um campo forjado no
    // formulário gravaria qualquer chave na tabela de configurações.
    if (!PERMITIDAS.has(chave)) continue;

    const texto = String(valor).trim().slice(0, 200);
    if (texto === "") continue;

    await gravarConfiguracao(chave, texto);
  }

  revalidatePath("/ajustes");
  return { mensagem: "Ajustes salvos." };
}
