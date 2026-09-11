import type { Metadata } from "next";
import { Link2, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Entrada } from "@/components/motion/entrada";
import { Heroi } from "@/components/painel/heroi";
import { FormularioCheckout } from "@/app/(painel)/vendas/formulario-checkout";
import { FormularioVendaManual } from "@/app/(painel)/vendas/formulario-venda-manual";
import { SeletorPeriodo } from "@/app/(painel)/vendas/seletor-periodo";
import { GraficoReceita } from "@/components/painel/grafico-receita";
import { CartaoContador, NumeroPrincipal } from "@/components/painel/cartao-contador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ehPeriodo,
  listarVendas,
  obterHojeEOntem,
  obterResumo,
  obterSerieReceita,
  PERIODOS,
  type ChavePeriodo,
} from "@/db/vendas";
import { emModoTeste, formatarDinheiro } from "@/lib/pagamento/stripe";

export const metadata: Metadata = { title: "Vendas" };
export const dynamic = "force-dynamic";

const MEIO: Record<string, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cartao_stripe: "Cartão · Stripe",
  outro: "Outro",
};

export default async function PaginaVendas({ searchParams }: PageProps<"/vendas">) {
  const sp = await searchParams;
  const bruto = Array.isArray(sp.periodo) ? sp.periodo[0] : sp.periodo;
  const periodo: ChavePeriodo = ehPeriodo(bruto) ? bruto : "7d";

  const [resumo, serie, vendas, hoje] = await Promise.all([
    obterResumo(periodo),
    obterSerieReceita(periodo),
    listarVendas(20),
    obterHojeEOntem(),
  ]);

  const teste = emModoTeste();

  return (
    <Entrada className="flex flex-col gap-6">
      <header data-entrada className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre o que já caiu na conta, ou gere um link de cartão pela Stripe.
          </p>
        </div>

        <SeletorPeriodo atual={periodo} />
      </header>

      {teste && (
        // Aviso permanente e impossível de ignorar: em modo de teste a
        // Stripe aceita cartões fictícios, e é fácil comemorar uma venda
        // que não existe.
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          Chave de <strong>teste</strong> ativa. Os pagamentos são simulados e nenhum dinheiro entra
          de verdade.
        </p>
      )}

      <div data-entrada>
        <Heroi
          rotuloSuperior="Sala de receita"
          rotulo="Vendas hoje"
          centavos={hoje.hojeCentavos}
          variacao={hoje.variacao}
          detalhe={
            hoje.vendasHoje === 0
              ? "Nenhuma venda confirmada hoje ainda."
              : `${hoje.vendasHoje} ${hoje.vendasHoje === 1 ? "venda confirmada" : "vendas confirmadas"} hoje.`
          }
        />
      </div>

      <section data-entrada aria-label="Resumo financeiro" className="grid gap-3 lg:grid-cols-3">
        <NumeroPrincipal
          rotulo={`Recebido · ${PERIODOS[periodo].rotulo.toLowerCase()}`}
          valorTexto={formatarDinheiro(resumo.totalCentavos)}
          detalhe="Manual e Stripe, só o que já foi pago."
        />

        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
          <CartaoContador rotulo="Vendas" valor={resumo.quantidade} Icone={Receipt} tom="bom" />
          <CartaoContador
            rotulo="Ticket médio"
            valor={0}
            valorTexto={formatarDinheiro(resumo.ticketCentavos)}
            Icone={TrendingUp}
            tom="info"
          />
          <CartaoContador
            rotulo="Links em aberto"
            valor={resumo.pendentes}
            Icone={Wallet}
            tom={resumo.pendentes > 0 ? "atencao" : "neutro"}
            detalhe="Aguardando pagamento."
          />
        </div>
      </section>

      {resumo.quantidade > 0 && (
        <div data-entrada>
          <Card className="vidro brasa">
            <CardContent className="pt-6">
              <GraficoReceita serie={serie} />
            </CardContent>
          </Card>
        </div>
      )}

      <div data-entrada className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          {/* Manual em cima: é o caso comum (Pix direto). O checkout da
              Stripe fica para quem só paga no cartão. */}
          <FormularioVendaManual />
          <FormularioCheckout />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {vendas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Link2 className="size-7 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Nenhuma venda ainda</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Registre ao lado o que já caiu na conta, ou gere um link de cartão. Pagamentos
                  pela Stripe aparecem aqui sozinhos.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {vendas.map((v) => {
                  const cor =
                    v.status === "pago"
                      ? "text-emerald-300"
                      : v.status === "pendente"
                        ? "text-amber-300"
                        : "text-muted-foreground";

                  return (
                    <li key={v.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{v.descricao}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.cliente_nome ?? v.cliente_email ?? "Sem identificação"}
                          {" · "}
                          {MEIO[v.meio_pagamento ?? (v.origem === "stripe" ? "cartao_stripe" : "outro")]}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="num font-semibold">
                          {formatarDinheiro(v.valor_centavos, v.moeda)}
                        </p>
                        {/* Palavra, não só cor: "pago" e "pendente" não
                            podem depender de distinguir verde de âmbar. */}
                        <p className={`text-xs font-medium ${cor}`}>
                          {v.status === "pago"
                            ? "Pago"
                            : v.status === "pendente"
                              ? "Aguardando"
                              : v.status === "cancelado"
                                ? "Cancelado"
                                : "Reembolsado"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Entrada>
  );
}
