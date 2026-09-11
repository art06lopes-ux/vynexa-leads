import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, CircleAlert, Flame, Globe, MessageCircle, Search } from "lucide-react";

import { Entrada } from "@/components/motion/entrada";
import { BotaoAnalisar } from "@/components/painel/botao-analisar";
import { CartaoContador, NumeroPrincipal } from "@/components/painel/cartao-contador";
import { GraficoLeads } from "@/components/painel/grafico-leads";
import { Heroi } from "@/components/painel/heroi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  contarSemAnalise,
  listarBuscasRecentes,
  obterContadores,
  obterSerieLeads,
} from "@/db/consultas";
import { obterHojeEOntem } from "@/db/vendas";
import { nomeDoPais } from "@/lib/geo/paises";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";
import type { Busca } from "@/db/tipos";

export const metadata: Metadata = { title: "Painel" };

// Os contadores mudam a cada execução do worker; cache aqui mostraria
// números velhos logo depois de uma busca.
export const dynamic = "force-dynamic";

export default async function PaginaPainel() {
  const [contadores, buscas, semAnalise, serie, hoje] = await Promise.all([
    obterContadores(),
    listarBuscasRecentes(),
    contarSemAnalise(),
    obterSerieLeads(14),
    obterHojeEOntem(),
  ]);

  return (
    <Entrada className="flex flex-col gap-6">
      <header data-entrada className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campo vazio é campo que a fonte não trouxe — nada aqui é preenchido por dedução.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BotaoAnalisar pendentes={semAnalise} />

          <Button render={<Link href="/buscar" />} nativeButton={false} className="h-11 cursor-pointer">
            <Search className="size-4" aria-hidden="true" />
            Nova caçada
          </Button>
        </div>
      </header>

      {/* Herói: o dinheiro de hoje. É o número que se quer ver ao abrir. */}
      <div data-entrada>
        <Heroi
          rotuloSuperior="Sala de receita"
          rotulo="Recebido hoje"
          centavos={hoje.hojeCentavos}
          variacao={hoje.variacao}
          detalhe={
            hoje.vendasHoje === 0
              ? "Nenhuma venda confirmada hoje ainda."
              : `${hoje.vendasHoje} ${hoje.vendasHoje === 1 ? "venda confirmada" : "vendas confirmadas"} hoje.`
          }
        />
      </div>

      <section
        data-entrada
        aria-label="Resumo da carteira"
        className="grid gap-3 lg:grid-cols-3"
      >
        <NumeroPrincipal
          rotulo="Empresas na carteira"
          valor={contadores.total}
          detalhe="Total acumulado de todas as caçadas, sem duplicatas."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <CartaoContador
            rotulo="Sem site próprio"
            valor={contadores.semSite}
            total={contadores.total}
            Icone={Globe}
            tom="bom"
          />
          <CartaoContador
            rotulo="Com WhatsApp"
            valor={contadores.comWhatsapp}
            total={contadores.total}
            Icone={MessageCircle}
            tom="bom"
          />
          <CartaoContador
            rotulo="Com e-mail"
            valor={contadores.comEmail}
            total={contadores.total}
            Icone={AtSign}
            tom="info"
          />
          <CartaoContador
            rotulo="Oportunidade alta"
            valor={contadores.oportunidadeAlta}
            Icone={Flame}
            tom="atencao"
            detalhe={
              contadores.oportunidadeAlta === 0 && semAnalise > 0
                ? `${semAnalise} empresa(s) ainda sem análise.`
                : "Score 70 ou mais."
            }
          />
        </div>
      </section>

      {contadores.total > 0 && (
        <div data-entrada>
          <Card className="vidro brasa">
            <CardContent className="pt-6">
              <GraficoLeads serie={serie} />
            </CardContent>
          </Card>
        </div>
      )}

      <div data-entrada>
        <BuscasRecentes buscas={buscas} />
      </div>
    </Entrada>
  );
}

function BuscasRecentes({ buscas }: { buscas: Busca[] }) {
  if (buscas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Search className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Nenhuma caçada ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Comece por uma cidade e um segmento só, para ver quanta coisa o OpenStreetMap tem
            mapeado da sua região.
          </p>
          <Button render={<Link href="/buscar" />} nativeButton={false} className="mt-2 h-11 cursor-pointer">
            Fazer a primeira
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ROTULO: Record<Busca["status"], { texto: string; classe: string }> = {
    pendente: { texto: "Na fila", classe: "border-slate-400/25 bg-slate-400/10 text-slate-300" },
    em_andamento: { texto: "Rastreando", classe: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
    concluida: {
      texto: "Concluída",
      classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    },
    erro: { texto: "Erro", classe: "border-destructive/30 bg-destructive/10 text-destructive" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Caçadas recentes</CardTitle>
        <Link
          href="/historico"
          className="cursor-pointer text-xs text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {buscas.map((b) => {
            const local = [b.cidade, b.estado, nomeDoPais(b.pais)].filter(Boolean).join(", ");
            const status = ROTULO[b.status];

            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{rotuloDoSegmento(b.segmento)}</p>
                  <p className="truncate text-xs text-muted-foreground">{local}</p>
                </div>

                {b.status === "concluida" && (
                  <p className="num text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{b.quantidade_encontrada}</span>{" "}
                    achadas ·{" "}
                    <span className="font-medium text-emerald-300">{b.quantidade_nova}</span> novas
                    {b.expansoes > 0 && b.raio_final_km !== null && (
                      <> · raio {b.raio_final_km} km</>
                    )}
                  </p>
                )}

                {b.status === "erro" && b.erro && (
                  <p className="max-w-sm truncate text-sm text-destructive" title={b.erro}>
                    {b.erro}
                  </p>
                )}

                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${status.classe}`}
                >
                  {b.status === "erro" && (
                    <CircleAlert className="mr-1.5 size-3.5" aria-hidden="true" />
                  )}
                  {status.texto}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
