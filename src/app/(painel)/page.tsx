import { Activity, Flame, Radar, RotateCcw, Search, Send } from "lucide-react";
import Link from "next/link";

import { Cartao, Vazio } from "@/components/base/cartao";
import { LimparBuscas } from "@/components/dashboard/limpar-buscas";
import { Carteira } from "@/components/inicio/carteira";
import { LucroPorPeriodo } from "@/components/inicio/lucro-por-periodo";
import { PainelLucro } from "@/components/inicio/painel-lucro";
import { SeloPresenca } from "@/components/leads/presenca";
import { AnelScore } from "@/components/leads/score";
import { EsculturaV } from "@/components/marca/escultura-v";
import { Contador } from "@/components/motion/contador";
import { Entrada } from "@/components/motion/entrada";
import type { QualidadeSite, StatusSite } from "@/db/tipos";
import { atividadeRecente, buscasRecentes, lerIdentidade, melhoresOportunidades, obterKpis, paraRetomar, vendasPagasDoAno } from "@/db/painel";
import { hojePorExtenso, saudacao } from "@/lib/datas";
import { haQuantoTempo } from "@/services/crm";
import { ROTULO_EVENTO } from "@/services/eventos";

export const metadata = { title: "Início" };

/** Lucro e receita de um mês do calendário (0 = este mês, 1 = o anterior). */
function doMes(vendas: Awaited<ReturnType<typeof vendasPagasDoAno>>, mesesAtras: number) {
  const agora = new Date();
  const de = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1).getTime();
  const ate = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras + 1, 1).getTime();
  let receita = 0;
  let lucro = 0;
  for (const v of vendas) {
    const t = new Date(`${v.pagoEm.replace(" ", "T")}Z`).getTime();
    if (t >= de && t < ate) {
      receita += v.valor;
      lucro += v.valor - v.custo;
    }
  }
  return { receita, lucro };
}

export default async function Inicio() {
  const [identidade, kpis, vendas, top, atividade, buscas, retomar] = await Promise.all([
    lerIdentidade(),
    obterKpis(),
    vendasPagasDoAno(),
    melhoresOportunidades(5),
    atividadeRecente(8),
    buscasRecentes(4),
    paraRetomar(5),
  ]);
  const fuso = identidade.config.fuso || "America/Manaus";
  const primeiroNome = identidade.responsavel.split(" ")[0];
  const mes = doMes(vendas, 0);
  const anterior = doMes(vendas, 1);
  const variacaoMes = anterior.lucro > 0 ? Math.round(((mes.lucro - anterior.lucro) / anterior.lucro) * 1000) / 10 : mes.lucro > 0 ? null : 0;

  return (
    <div className="space-y-5">
      <Entrada className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{hojePorExtenso(fuso)}</p>
          <h1 className="mt-0.5 text-[1.9rem] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">
            {saudacao(fuso)}, {primeiroNome}.
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {kpis.paraAbordar > 0 ? (
            <>
              <Link href="/leads?situacao=nao_abordados" className="font-semibold text-foreground underline decoration-brilho/60 underline-offset-4">
                {kpis.paraAbordar} empresas
              </Link>{" "}
              esperando abordagem
              {retomar.total > 0 && (
                <>
                  {" · "}
                  <Link href="/leads?situacao=retomar" className="font-semibold text-foreground underline decoration-brilho/60 underline-offset-4">
                    {retomar.total} para retomar
                  </Link>
                </>
              )}
            </>
          ) : (
            "Vamos encontrar sua próxima venda."
          )}
        </p>
      </Entrada>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <Entrada atraso={0.04}>
            <PainelLucro vendas={vendas} />
          </Entrada>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Entrada atraso={0.08}>
              <section className="heroi relative flex h-full min-h-60 flex-col justify-between p-5 sm:p-6">
                <EsculturaV className="absolute -bottom-10 -right-12 -z-10 h-56 opacity-90" camadas={18} />
                <div>
                  <h2 className="text-xl font-semibold leading-tight text-white">Sua próxima venda começa agora.</h2>
                  <p className="mt-1.5 max-w-[16rem] text-sm text-white/90">
                    <Contador valor={kpis.paraAbordar} className="font-semibold" /> empresas esperando seu primeiro movimento.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/leads?situacao=nao_abordados" className="inline-flex h-10 items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold">
                    <Send className="size-4" /> Abordar agora
                  </Link>
                  <Link href="/buscar" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-black/20 px-4 text-sm font-semibold text-white hover:bg-black/30">
                    <Radar className="size-4" /> Mapear no Radar
                  </Link>
                </div>
              </section>
            </Entrada>
            <Entrada atraso={0.12}>
              <LucroPorPeriodo vendas={vendas} />
            </Entrada>
          </div>
        </div>
        <Entrada atraso={0.06} className="xl:col-span-4">
          <Carteira vendas={vendas} lucroMes={mes.lucro} receitaMes={mes.receita} variacao={variacaoMes} />
        </Entrada>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Entrada>
          <Cartao icone={Flame} titulo="Não abordados" subtitulo="Melhor score primeiro" href="/leads?situacao=nao_abordados" className="h-full" corpoClassName="px-3 pb-3">
            {top.length === 0 ? (
              <Vazio icone={Radar} titulo="Ninguém esperando" descricao="Mapeie empresas no Radar e elas aparecem aqui." acao={<BotaoRadar />} className="py-8" />
            ) : (
              <ul className="space-y-1">
                {top.map((l) => (
                  <li key={l.lead_id}>
                    <Link href={`/leads/${l.lead_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
                      <AnelScore score={l.score} tamanho={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.cidade ?? l.categoria}
                          {l.avaliacao_qtd ? ` · ${l.avaliacao_nota?.toFixed(1).replace(".", ",")}★ (${l.avaliacao_qtd})` : ""}
                        </p>
                      </div>
                      <SeloPresenca statusSite={l.status_site as StatusSite} qualidade={l.site_qualidade as QualidadeSite | null} className="hidden 2xl:inline-flex" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </Entrada>

        <Entrada>
          <Cartao
            icone={RotateCcw}
            titulo="Retomar contato"
            subtitulo={retomar.total > 0 ? `${retomar.total} sem resposta há 3 dias ou mais` : "Quem você abordou e ainda não respondeu"}
            href="/leads?situacao=retomar"
            className="h-full"
            corpoClassName="px-3 pb-3"
          >
            {retomar.itens.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Ninguém esfriando. Quem ficar 3 dias sem responder aparece aqui.</p>
            ) : (
              <ul className="space-y-0.5">
                {retomar.itens.map((r) => (
                  <li key={r.lead_id}>
                    <Link href={`/leads/${r.lead_id}#abordagem`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/[0.04]">
                      <span className="size-1.5 shrink-0 rounded-full bg-aviso" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.nome}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{haQuantoTempo(r.contatado_em)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </Entrada>

        <Entrada>
          <Cartao icone={Search} titulo="Buscas recentes" href="/buscar" className="h-full" corpoClassName="px-3 pb-3">
            {buscas.length === 0 ? (
              <Vazio icone={Radar} titulo="Nenhuma busca ainda" descricao="Sua primeira busca aparece aqui." acao={<BotaoRadar />} className="py-8" />
            ) : (
              <ul className="space-y-0.5">
                {buscas.map((b) => (
                  <li key={b.id}>
                    <Link href={`/buscar?busca=${b.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{b.consulta_natural ?? `${b.segmento}${b.cidade ? ` em ${b.cidade}` : ""}`}</span>
                        <span className="text-xs text-muted-foreground">{haQuantoTempo(b.criado_em)}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block font-semibold num">{b.quantidade_encontrada}</span>
                        <span className="text-muted-foreground">{b.status === "concluida" ? `${b.quantidade_nova} novas` : b.status === "erro" ? "erro" : "rodando"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {buscas.length > 0 && <LimparBuscas />}
          </Cartao>
        </Entrada>
      </div>

      <Entrada>
        <Cartao icone={Activity} titulo="Atividade recente" subtitulo="O que aconteceu com as empresas da carteira" corpoClassName="px-3 pb-3">
          {atividade.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Quando você analisar, abordar ou fechar um lead, aparece aqui.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 md:grid-cols-2">
              {atividade.map((a) => (
                <li key={a.id}>
                  <Link href={`/leads/${a.lead_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/[0.04]">
                    <span className="size-1.5 shrink-0 rounded-full bg-ciano" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{a.nome}</span>
                      <span className="text-muted-foreground"> — {ROTULO_EVENTO[a.tipo as keyof typeof ROTULO_EVENTO] ?? a.tipo}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{haQuantoTempo(a.criado_em)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </Entrada>
    </div>
  );
}

function BotaoRadar() {
  return (
    <Link href="/buscar" className="inline-flex h-10 items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-sobre-brasa hover:bg-brilho">
      <Radar className="size-4" /> Abrir o Radar
    </Link>
  );
}
