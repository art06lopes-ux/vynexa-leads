"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { criarValorDeSessao, NOME_COOKIE, OPCOES_COOKIE, senhaCorreta } from "@/lib/auth";
import type { EstadoAcao } from "@/server/estado-acao";

export async function entrar(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const senha = String(form.get("senha") ?? "");
  const destinoBruto = String(form.get("destino") ?? "");

  if (senha === "") return { mensagem: "Informe a senha." };

  if (!senhaCorreta(senha)) {
    // Uma pausa curta encarece a tentativa em força bruta sem atrapalhar
    // quem só errou a senha uma vez.
    await new Promise((r) => setTimeout(r, 600));
    return { mensagem: "Senha incorreta." };
  }

  const { valor, expiraEm } = await criarValorDeSessao();
  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE, valor, { ...OPCOES_COOKIE, expires: expiraEm });

  // Só destino interno. Sem esta checagem, `?destino=https://…`
  // transformaria a tela de login num redirecionador aberto.
  const destino =
    destinoBruto.startsWith("/") && !destinoBruto.startsWith("//") ? destinoBruto : "/";

  revalidatePath("/", "layout");
  redirect(destino);
}

export async function sair(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
