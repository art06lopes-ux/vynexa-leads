import type { Metadata } from "next";
import { Link2, Receipt, Wallet } from "lucide-react";

import { Entrada } from "@/components/motion/entrada";
import { CabecalhoPagina, TituloSecao } from "@/components/painel/cabecalho-pagina";
import { Heroi } from "@/components/painel/heroi";
import { FormularioCheckout } from "@/app/(painel)/vendas/formulario-checkout";
import { FormularioVendaManual } from "@/app/(painel)/vendas/formulario-venda-manual";
import { SeletorPeriodo } from "@/app/(painel)/vendas/seletor-periodo";
import { GraficoLinha } from "@/components/painel/grafico-linha";
import { CartaoContador } from "@/components/painel/cartao-contador";
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

function dataHoje(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

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
      <div data-entrada>
        <CabecalhoPagina
          olho="Sala de receita"
          titulo="Vendas"
          descricao="Registre o que já caiu na conta, ou gere um link de cartão pela Stripe."
          acoes={<SeletorPeriodo atual={periodo} />}
        />
      </div>

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
          olho="Sala de receita · Vynexa Dev"
          titulo="Vendas hoje"
          subtitulo={dataHoje()}
          centavos={hoje.hojeCentavos}
          variacao={hoje.variacao}
          metricas={[
            { olho: "Vendas confirmadas", valor: hoje.vendasHoje, formato: "inteiro", detalhe: "hoje" },
            { olho: "Ticket médio", valor: resumo.ticketCentavos, formato: "dinheiro", detalhe: PERIODOS[periodo].rotulo.toLowerCase() },
            { olho: `Recebido · ${PERIODOS[periodo].rotulo.toLowerCase()}`, valor: resumo.totalCentavos, formato: "dinheiro", detalhe: `${resumo.quantidade} venda(s)` },
          ]}
        />
      </div>

      <section data-entrada aria-label="Tendência" className="flex flex-col gap-3">
        <TituloSecao olho="Desempenho por período" titulo="Tendência de vendas" />
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-4">
            <Card className="vidro brasa h-full">
              <CardContent className="pt-5">
                <GraficoLinha
                  olho="Receita confirmada ao longo do período"
                  titulo={`Receita por dia · ${PERIODOS[periodo].rotulo.toLowerCase()}`}
                  serie={serie.atual}
                  comparacao={serie.anterior}
                  rotuloSerie="Período atual"
                  rotuloComparacao="Período anterior"
                  formato="dinheiro"
                />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <CartaoContador rotulo="Vendas no período" valor={resumo.quantidade} formato="inteiro" Icone={Receipt} tom="bom" />
            <CartaoContador
              rotulo="Links em aberto"
              valor={resumo.pendentes}
              formato="inteiro"
              Icone={Wallet}
              tom={resumo.pendentes > 0 ? "atencao" : "neutro"}
              detalhe="aguardando pagamento"
            />
          </div>
        </div>
      </section>

      <section data-entrada className="flex flex-col gap-3">
        <TituloSecao olho="Lançamentos" titulo="Registrar e acompanhar" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
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
      </section>
    </Entrada>
  );
}
