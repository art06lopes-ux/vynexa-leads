"use server";

import { revalidatePath } from "next/cache";

import { gravarConfiguracao } from "@/db/configuracoes";
import { exigirSessao } from "@/server/sessao";
import type { EstadoAcao } from "@/server/estado-acao";

/** Só estas chaves podem ser gravadas pela interface. */
const PERMITIDAS = new Set(["empresa_nome", "moeda_padrao", "remetente_nome", "receita_ufs"]);

const UFS = new Set([
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE",
  "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]);

export async function salvarAjustes(
  _anterior: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  await exigirSessao();

  for (const [chave, valor] of form.entries()) {
    // Lista de permissão, não de bloqueio: sem ela, um campo forjado no
    // formulário gravaria qualquer chave na tabela de configurações.
    if (!PERMITIDAS.has(chave)) continue;

    let texto = String(valor).trim().slice(0, 200);

    // Lista de estados: só siglas reais, sem repetição, em ordem. Uma
    // sigla inventada faria o importador baixar 5 GB para não achar nada.
    if (chave === "receita_ufs") {
      const siglas = [...new Set(texto.toUpperCase().split(/[,\s;]+/).filter((u) => UFS.has(u)))];
      texto = siglas.sort().join(",");
      await gravarConfiguracao(chave, texto);
      continue;
    }

    if (texto === "") continue;
    await gravarConfiguracao(chave, texto);
  }

  revalidatePath("/ajustes");
  return { mensagem: "Ajustes salvos." };
}
