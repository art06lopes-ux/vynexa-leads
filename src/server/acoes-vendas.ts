"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { agora, getBanco, novoId } from "@/db/cliente";
import { formatarDinheiro, paraCentavos } from "@/lib/pagamento/dinheiro";
import { notificarTodos } from "@/lib/push/enviar";
import { exigirSessao } from "@/server/sessao";
import type { EstadoAcao } from "@/server/estado-acao";

const MEIOS = ["pix", "transferencia", "dinheiro", "outro"] as const;

const Esquema = z.object({
  descricao: z.string().trim().min(3, "Descreva o que foi vendido.").max(200),
  valor: z.string().trim().min(1, "Informe o valor."),
  meio: z.enum(MEIOS),
  clienteNome: z.string().trim().max(120).optional(),
  // "AAAA-MM-DD" do <input type="date">. Vazio = hoje.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
});

/**
 * Cadastra uma venda que já foi paga por fora — Pix, transferência,
 * dinheiro. É o caso principal: a Stripe fica só para cartão.
 *
 * Nasce direto como `pago`, porque o dinheiro já está na conta. A data é
 * editável para registrar hoje o Pix que caiu ontem sem distorcer o
 * gráfico do dia.
 */
export async function cadastrarVendaManual(
  _anterior: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  await exigirSessao();

  const analise = Esquema.safeParse({
    descricao: form.get("descricao"),
    valor: form.get("valor"),
    meio: form.get("meio"),
    clienteNome: form.get("clienteNome") ?? undefined,
    data: form.get("data") ?? "",
  });

  if (!analise.success) {
    return { mensagem: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { descricao, valor, meio, clienteNome, data } = analise.data;

  const centavos = paraCentavos(valor);
  if (centavos === null || centavos <= 0) {
    return { mensagem: "Informe um valor maior que zero." };
  }

  // Data escolhida ganha a hora atual, para ordenar corretamente entre
  // vendas do mesmo dia. Sem data, é agora.
  const pagoEm = data ? `${data} ${agora().slice(11)}` : agora();

  await getBanco().execute({
    sql: `INSERT INTO vendas (id, descricao, valor_centavos, moeda, status, origem, meio_pagamento, cliente_nome, pago_em)
          VALUES (?, ?, ?, 'BRL', 'pago', 'manual', ?, ?, ?)`,
    args: [novoId(), descricao, centavos, meio, clienteNome || null, pagoEm],
  });

  revalidatePath("/vendas");
  revalidatePath("/");

  // Depois de gravar, nunca antes: uma falha no push não pode impedir a
  // venda de entrar. E `notificarTodos` não lança de propósito.
  await notificarTodos({
    titulo: "Venda realizada",
    corpo: `Você recebeu: ${formatarDinheiro(centavos)}${clienteNome ? ` · ${clienteNome}` : ""}`,
    url: "/vendas",
  });

  return { mensagem: `Venda de ${formatarDinheiro(centavos)} registrada.` };
}

export async function excluirVenda(id: string): Promise<void> {
  await exigirSessao();
  // Só manual: venda da Stripe é registro do que a Stripe confirmou, e
  // apagar isso aqui deixaria o painel dizendo menos do que entrou.
  await getBanco().execute({
    sql: `DELETE FROM vendas WHERE id = ? AND origem = 'manual'`,
    args: [id],
  });
  revalidatePath("/vendas");
  revalidatePath("/");
}
