import { CreditCard, TrendingUp } from "lucide-react";

import { AvisoConfiguracao, Cabecalho, Cartao } from "@/components/base/cartao";
import { GraficoBarras } from "@/components/graficos/graficos";
import { Contador } from "@/components/motion/contador";
import { Entrada, Escalonado, ItemEscalonado } from "@/components/motion/entrada";
import { TabelaVendas } from "@/components/pagamentos/tabela-vendas";
import { getBanco } from "@/db/cliente";
import { serieMensal } from "@/db/painel";
import { listarVendas, resumoFinanceiro } from "@/db/vendas";
import { obterPagamentos } from "@/integrations/pagamentos/asaas";
import { rotuloMes } from "@/lib/datas";

export const metadata = { title: "Pagamentos" };

export default async function PaginaPagamentos() {
  const [resumo, vendas, mensal, asaas, prods] = await Promise.all([
    resumoFinanceiro(),
    listarVendas(),
    serieMensal(12),
    obterPagamentos().pronto(),
    getBanco().execute(`SELECT id, nome, preco_centavos FROM produtos WHERE ativo = 1 ORDER BY ordem, nome`),
  ]);
  const produtos = prods.rows.map((r) => ({ id: String(r.id), nome: String(r.nome), preco_centavos: Number(r.preco_centavos) }));

  const cartoes = [
    { rotulo: "Receita total", valor: resumo.totalCentavos, moeda: true },
    { rotulo: "Receita este mês", valor: resumo.mesCentavos, moeda: true },
    { rotulo: "Vendas", valor: resumo.vendas },
    { rotulo: "Ticket médio", valor: resumo.ticketCentavos, moeda: true },
    { rotulo: "Pagamentos pendentes", valor: resumo.pendentesCentavos, moeda: true, detalhe: `${resumo.pendentes} cobrança(s)` },
    { rotulo: "Recebidos no mês", valor: resumo.recebidosMes, detalhe: "pagamentos" },
    { rotulo: "Vencidos", valor: resumo.vencidosCentavos, moeda: true, detalhe: `${resumo.vencidos} cobrança(s)` },
  ];

  return (
    <div className="space-y-5">
      <Cabecalho icone={CreditCard} titulo="Pagamentos" descricao="Vendas, cobranças pelo Asaas (Pix, boleto, cartão) e a receita que entra." />
      {!asaas.ok && (
        <AvisoConfiguracao titulo="Asaas ainda não configurado">
          Sem a chave, as vendas podem ser registradas e marcadas como pagas à mão, mas a cobrança automática e a confirmação por webhook ficam desligadas.
        </AvisoConfiguracao>
      )}
      {asaas.ok && <p className="text-xs text-muted-foreground">Asaas conectado · ambiente {asaas.ambiente === "producao" ? "de produção" : "sandbox (teste)"}</p>}

      <Escalonado className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cartoes.map((c, i) => (
          <ItemEscalonado key={c.rotulo} className={i === 0 ? "heroi col-span-2 p-4 md:col-span-2 xl:col-span-1" : "placa p-4"}>
            <p className={i === 0 ? "text-xs text-white/70" : "text-xs text-muted-foreground"}>{c.rotulo}</p>
            <Contador valor={c.valor} formato={c.moeda ? "moeda" : "inteiro"} className={`font-display text-xl font-semibold ${i === 0 ? "text-white" : ""}`} />
            {c.detalhe && <p className="text-[0.7rem] text-muted-foreground">{c.detalhe}</p>}
          </ItemEscalonado>
        ))}
      </Escalonado>

      <Entrada>
        <Cartao icone={TrendingUp} titulo="Receita por mês" subtitulo="Últimos 12 meses, só vendas pagas">
          <GraficoBarras
            titulo="Receita por mês"
            dados={mensal.map((m) => ({ rotulo: rotuloMes(m.mes), valores: { receita: m.receita } }))}
            series={[{ chave: "receita", rotulo: "Receita", cor: "#3987e5" }]}
            formato="moeda"
            altura={220}
          />
        </Cartao>
      </Entrada>

      <TabelaVendas vendas={vendas} asaasPronto={asaas.ok} produtos={produtos} />
    </div>
  );
}
