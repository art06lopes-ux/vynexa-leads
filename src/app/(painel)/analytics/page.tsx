import { ChartColumn, Globe2, Layers, Megaphone, TrendingUp } from "lucide-react";

import { AbasPagina } from "@/components/base/abas-pagina";
import { Cabecalho, Cartao } from "@/components/base/cartao";
import { BarrasHorizontais, Funil, GraficoArea, GraficoBarras } from "@/components/graficos/graficos";
import { Contador } from "@/components/motion/contador";
import { Entrada, Escalonado, ItemEscalonado } from "@/components/motion/entrada";
import { getBanco, planos } from "@/db/cliente";
import { obterKpis, porCategoria, porPais, serieDiaria, serieMensal } from "@/db/painel";
import { nomePaisPt } from "@/lib/geo/mundo";
import { rotuloDia, rotuloMes } from "@/lib/datas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { taxa } from "@/services/crm";

export const metadata = { title: "Relatórios" };

type Roi = { id: string; nome: string; enviados: number; abertos: number; respostas: number; vendas: number; receita: number };

const ABAS_VENDAS = [
  { chave: "vendas", rotulo: "Vendas e cobranças", href: "/pagamentos" },
  { chave: "relatorios", rotulo: "Relatórios", href: "/analytics" },
];

export default async function PaginaAnalytics() {
  const banco = getBanco();
  const [kpis, leads30, semSite30, contatos30, respostas30, vendas30, mensal, categorias, paises, extra, roi] = await Promise.all([
    obterKpis(),
    serieDiaria("leads", 30),
    serieDiaria("sem_site", 30),
    serieDiaria("contatos", 30),
    serieDiaria("respostas", 30),
    serieDiaria("vendas", 30),
    serieMensal(6),
    porCategoria(10),
    porPais(8),
    banco.execute(`SELECT
        (SELECT COUNT(*) FROM buscas) buscas,
        (SELECT COALESCE(SUM(quantidade_encontrada),0) FROM buscas) pesquisados,
        (SELECT COALESCE(SUM(requisicoes),0) FROM buscas WHERE provedor = 'google_places') req_google,
        (SELECT COUNT(*) FROM empresas WHERE whatsapp = 1) whats,
        (SELECT COUNT(*) FROM empresas WHERE email IS NOT NULL) emails,
        (SELECT COUNT(*) FROM mensagens) mensagens,
        (SELECT COUNT(*) FROM envios WHERE enviado_em IS NOT NULL) enviados,
        (SELECT COUNT(*) FROM envios WHERE status IN ('entregue','aberto','clicado','respondeu')) entregues,
        (SELECT COUNT(*) FROM envios WHERE aberto_em IS NOT NULL) abertos`),
    banco.execute(`SELECT c.id, c.nome, c.enviados, c.abertos, c.respostas,
        (SELECT COUNT(*) FROM vendas v WHERE v.campanha_id = c.id AND v.status = 'pago') vendas,
        (SELECT COALESCE(SUM(valor_centavos),0) FROM vendas v WHERE v.campanha_id = c.id AND v.status = 'pago') receita
      FROM campanhas c WHERE c.enviados > 0 ORDER BY receita DESC, c.respostas DESC LIMIT 12`),
  ]);
  const x = extra.rows[0] ?? {};
  const n = (k: string) => Number(x[k] ?? 0);
  const roiLista = planos<Roi>(roi.rows);

  const metricas: Array<[string, number, "inteiro" | "moeda" | "percentual"]> = [
    ["Leads pesquisados", n("pesquisados"), "inteiro"],
    ["Leads encontrados", kpis.leads, "inteiro"],
    ["Sem site", kpis.semSite, "inteiro"],
    ["Com WhatsApp", n("whats"), "inteiro"],
    ["Com e-mail", n("emails"), "inteiro"],
    ["Qualificados", kpis.qualificados, "inteiro"],
    ["Mensagens geradas", n("mensagens"), "inteiro"],
    ["E-mails enviados", n("enviados"), "inteiro"],
    ["E-mails entregues", n("entregues"), "inteiro"],
    ["E-mails abertos", n("abertos"), "inteiro"],
    ["Respostas", kpis.respostas, "inteiro"],
    ["Propostas", kpis.propostas, "inteiro"],
    ["Vendas", kpis.vendas, "inteiro"],
    ["Receita", kpis.receitaTotalCentavos, "moeda"],
    ["Conversão", kpis.conversao ?? 0, "percentual"],
    ["Requisições ao Google", n("req_google"), "inteiro"],
  ];

  return (
    <div className="space-y-5">
      <Cabecalho icone={ChartColumn} titulo="Vendas" descricao="Relatórios da busca à venda, com os números reais do banco. Gráficos diários: últimos 30 dias." />
      <AbasPagina abas={ABAS_VENDAS} ativa="relatorios" />

      <Escalonado className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {metricas.map(([r, v, f]) => (
          <ItemEscalonado key={r} className="placa p-3.5">
            <p className="truncate text-[0.72rem] text-muted-foreground">{r}</p>
            <Contador valor={v} formato={f} className="font-display text-xl font-semibold" />
          </ItemEscalonado>
        ))}
      </Escalonado>

      <div className="grid gap-5 lg:grid-cols-2">
        <Entrada>
          <Cartao icone={TrendingUp} titulo="Leads por dia" subtitulo="Empresas novas na carteira">
            <GraficoArea pontos={leads30.map((p) => ({ rotulo: rotuloDia(p.dia), valor: p.valor }))} altura={170} eixo titulo="Leads por dia" />
          </Cartao>
        </Entrada>
        <Entrada atraso={0.04}>
          <Cartao icone={TrendingUp} titulo="Leads sem site por dia" subtitulo="Sem site ou só rede social">
            <GraficoArea pontos={semSite30.map((p) => ({ rotulo: rotuloDia(p.dia), valor: p.valor }))} altura={170} eixo cor="#2bd47d" titulo="Leads sem site por dia" />
          </Cartao>
        </Entrada>
        <Entrada>
          <Cartao icone={TrendingUp} titulo="Contatos, respostas e vendas" subtitulo="Por dia, últimos 30 dias">
            <GraficoBarras
              titulo="Contatos, respostas e vendas por dia"
              dados={contatos30.slice(-14).map((p, i) => ({
                rotulo: rotuloDia(p.dia),
                valores: { contatos: p.valor, respostas: respostas30.slice(-14)[i]?.valor ?? 0, vendas: vendas30.slice(-14)[i]?.valor ?? 0 },
              }))}
              series={[
                { chave: "contatos", rotulo: "Contatos", cor: "#3987e5" },
                { chave: "respostas", rotulo: "Respostas", cor: "#d95926" },
                { chave: "vendas", rotulo: "Vendas", cor: "#199e70" },
              ]}
              destacarUltimo={false}
              altura={200}
            />
          </Cartao>
        </Entrada>
        <Entrada atraso={0.04}>
          <Cartao icone={TrendingUp} titulo="Receita por mês" subtitulo="Vendas pagas">
            <GraficoBarras titulo="Receita por mês" dados={mensal.map((m) => ({ rotulo: rotuloMes(m.mes), valores: { receita: m.receita } }))} series={[{ chave: "receita", rotulo: "Receita", cor: "#3987e5" }]} formato="moeda" altura={200} />
          </Cartao>
        </Entrada>
        <Entrada>
          <Cartao icone={Layers} titulo="Leads por categoria" subtitulo="Com a parte sem site ao lado">
            <BarrasHorizontais itens={categorias.map((c) => ({ rotulo: c.rotulo, valor: c.total, extra: `${c.semSite} sem site` }))} />
          </Cartao>
        </Entrada>
        <Entrada atraso={0.04}>
          <Cartao icone={Globe2} titulo="Leads por país">
            <BarrasHorizontais itens={paises.map((p) => ({ rotulo: nomePaisPt(p.pais), valor: p.total }))} cor="#6fd3ff" />
          </Cartao>
        </Entrada>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Entrada className="lg:col-span-5">
          <Cartao icone={TrendingUp} titulo="Conversão do funil">
            <Funil
              titulo="Conversão do funil"
              etapas={[
                { rotulo: "Encontrados", valor: kpis.leads },
                { rotulo: "Qualificados", valor: kpis.qualificados },
                { rotulo: "Abordados", valor: kpis.contatados },
                { rotulo: "Responderam", valor: kpis.respostas },
                { rotulo: "Propostas", valor: kpis.propostas },
                { rotulo: "Vendas", valor: kpis.vendas },
              ]}
            />
          </Cartao>
        </Entrada>
        <Entrada className="lg:col-span-7">
          <Cartao icone={Megaphone} titulo="Retorno por campanha" subtitulo="Receita das vendas atribuídas a cada campanha (sem custo cadastrado, o retorno é a receita)">
            {roiLista.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma campanha enviada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Campanha</th>
                      <th className="pb-2 text-right font-medium">Enviados</th>
                      <th className="pb-2 text-right font-medium">Resposta</th>
                      <th className="pb-2 text-right font-medium">Vendas</th>
                      <th className="pb-2 text-right font-medium">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roiLista.map((r) => (
                      <tr key={r.id} className="border-t border-fio">
                        <td className="max-w-56 truncate py-2">{r.nome}</td>
                        <td className="py-2 text-right num">{r.enviados}</td>
                        <td className="py-2 text-right num">{taxa(r.respostas, r.enviados)?.toLocaleString("pt-BR") ?? "—"}%</td>
                        <td className="py-2 text-right num">{r.vendas}</td>
                        <td className="py-2 text-right font-semibold num">{formatarDinheiro(r.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>
        </Entrada>
      </div>
    </div>
  );
}
