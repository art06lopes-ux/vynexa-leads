import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, CircleAlert, Flame, Globe, MessageCircle, Radar } from "lucide-react";

import { Entrada } from "@/components/motion/entrada";
import { BotaoAnalisar } from "@/components/painel/botao-analisar";
import { CabecalhoPagina, TituloSecao } from "@/components/painel/cabecalho-pagina";
import { CartaoContador } from "@/components/painel/cartao-contador";
import { GraficoLinha } from "@/components/painel/grafico-linha";
import { Heroi } from "@/components/painel/heroi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  contarSemAnalise,
  listarBuscasRecentes,
  obterContadores,
  obterSerieLeads,
} from "@/db/consultas";
import { obterHojeEOntem, obterResumo } from "@/db/vendas";
import { nomeDoPais } from "@/lib/geo/paises";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";
import type { Busca } from "@/db/tipos";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

function dataHoje(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export default async function PaginaPainel() {
  const [contadores, buscas, semAnalise, serie, hoje, semana] = await Promise.all([
    obterContadores(),
    listarBuscasRecentes(6),
    contarSemAnalise(),
    obterSerieLeads(14),
    obterHojeEOntem(),
    obterResumo("7d"),
  ]);

  return (
    <Entrada className="flex flex-col gap-7">
      <div data-entrada>
        <CabecalhoPagina
          olho="Central de comando"
          titulo="Painel"
          descricao="Receita, carteira e caçadas. Campo vazio é campo que a fonte não trouxe — nada aqui é deduzido."
          acoes={
            <>
              <BotaoAnalisar pendentes={semAnalise} />
              <Button render={<Link href="/buscar" />} nativeButton={false} className="h-11 cursor-pointer gap-2">
                <Radar className="size-4" aria-hidden="true" />
                Nova caçada
              </Button>
            </>
          }
        />
      </div>

      <div data-entrada>
        <Heroi
          olho="Sala de receita · Vynexa Dev"
          titulo="Vendas hoje"
          subtitulo={dataHoje()}
          centavos={hoje.hojeCentavos}
          variacao={hoje.variacao}
          metricas={[
            { olho: "Vendas confirmadas", valor: hoje.vendasHoje, formato: "inteiro", detalhe: "hoje" },
            { olho: "Ticket médio · 7 dias", valor: semana.ticketCentavos, formato: "dinheiro", detalhe: "por venda" },
            { olho: "Recebido · 7 dias", valor: semana.totalCentavos, formato: "dinheiro", detalhe: `${semana.quantidade} venda(s)` },
          ]}
        />
      </div>

      <section data-entrada aria-label="Carteira de empresas" className="flex flex-col gap-3">
        <TituloSecao olho="Carteira" titulo="Empresas encontradas" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <CartaoContador
              rotulo="Empresas na carteira"
              valor={contadores.total}
              formato="inteiro"
              detalhe="Acumulado de todas as caçadas, sem duplicatas."
              destaque
            />
          </div>
          <CartaoContador rotulo="Sem site próprio" valor={contadores.semSite} total={contadores.total} Icone={Globe} tom="bom" />
          <CartaoContador rotulo="Com WhatsApp" valor={contadores.comWhatsapp} total={contadores.total} Icone={MessageCircle} tom="bom" />
          <CartaoContador rotulo="Com e-mail" valor={contadores.comEmail} total={contadores.total} Icone={AtSign} tom="info" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CartaoContador
            rotulo="Oportunidade alta"
            valor={contadores.oportunidadeAlta}
            Icone={Flame}
            tom="atencao"
            detalhe={
              contadores.oportunidadeAlta === 0 && semAnalise > 0
                ? `${semAnalise} sem análise ainda`
                : "score 70 ou mais"
            }
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <Card className="vidro brasa h-full">
              <CardContent className="pt-5">
                <GraficoLinha
                  olho="Tendência de prospecção"
                  titulo="Empresas encontradas por dia"
                  serie={serie.atual}
                  comparacao={serie.anterior}
                  rotuloSerie="Últimos 14 dias"
                  rotuloComparacao="14 dias anteriores"
                  formato="inteiro"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div data-entrada>
        <CacadasRecentes buscas={buscas} />
      </div>
    </Entrada>
  );
}

function CacadasRecentes({ buscas }: { buscas: Busca[] }) {
  const ROTULO: Record<Busca["status"], { texto: string; classe: string }> = {
    pendente: { texto: "Na fila", classe: "border-slate-400/25 bg-slate-400/10 text-slate-300" },
    em_andamento: { texto: "Rastreando", classe: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
    concluida: { texto: "Concluída", classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
    erro: { texto: "Erro", classe: "border-destructive/30 bg-destructive/10 text-destructive" },
  };

  return (
    <section aria-label="Caçadas recentes" className="flex flex-col gap-3">
      <TituloSecao
        olho="Operação"
        titulo="Caçadas recentes"
        extra={
          <Link
            href="/historico"
            className="cursor-pointer text-xs text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-acento hover:underline"
          >
            Ver histórico completo
          </Link>
        }
      />

      <Card className="vidro">
        <CardContent className="pt-2">
          {buscas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-16 items-center justify-center rounded-lg border border-border bg-black/25">
                <Radar className="size-7 text-muted-foreground" aria-hidden="true" />
              </span>
              <p className="font-medium">Nenhuma caçada ainda</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Comece por uma cidade e um segmento, para ver quanta coisa o OpenStreetMap tem mapeado
                da sua região.
              </p>
              <Button render={<Link href="/buscar" />} nativeButton={false} className="mt-1 h-11 cursor-pointer">
                Fazer a primeira
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {buscas.map((b) => {
                const local = [b.cidade, b.estado, nomeDoPais(b.pais)].filter(Boolean).join(", ");
                const status = ROTULO[b.status];

                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{rotuloDoSegmento(b.segmento)}</p>
                      <p className="truncate text-xs text-muted-foreground">{local}</p>
                    </div>

                    {b.status === "concluida" && (
                      <p className="num text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{b.quantidade_encontrada}</span> achadas ·{" "}
                        <span className="font-semibold text-emerald-300">{b.quantidade_nova}</span> novas
                        {b.expansoes > 0 && b.raio_final_km !== null && <> · raio {b.raio_final_km} km</>}
                      </p>
                    )}

                    {b.status === "erro" && b.erro && (
                      <p className="max-w-sm truncate text-sm text-destructive" title={b.erro}>
                        {b.erro}
                      </p>
                    )}

                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${status.classe}`}>
                      {b.status === "erro" && <CircleAlert className="mr-1.5 size-3.5" aria-hidden="true" />}
                      {status.texto}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
