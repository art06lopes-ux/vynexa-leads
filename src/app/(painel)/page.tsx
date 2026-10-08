import { Activity, Flame, Mail, MapPin, Megaphone, Radar, Search, Sparkles, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { Cartao, Vazio } from "@/components/base/cartao";
import { BuscaRapida } from "@/components/dashboard/busca-rapida";
import { Funil, GraficoArea, GraficoBarras } from "@/components/graficos/graficos";
import { AnelScore } from "@/components/leads/score";
import { SeloPresenca } from "@/components/leads/presenca";
import { Contador } from "@/components/motion/contador";
import { Entrada, Escalonado, ItemEscalonado } from "@/components/motion/entrada";
import type { QualidadeSite, StatusSite } from "@/db/tipos";
import { LimparBuscas } from "@/components/dashboard/limpar-buscas";
import { atividadeRecente, buscasRecentes, lerIdentidade, melhoresOportunidades, obterKpis, porEtapa, serieDiaria, serieMensal } from "@/db/painel";
import { hojePorExtenso, rotuloDia, rotuloMes, saudacao } from "@/lib/datas";
import { haQuantoTempo } from "@/services/crm";
import { ROTULO_EVENTO } from "@/services/eventos";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const [identidade, kpis, mensal, receita30, etapas, top, atividade, buscas] = await Promise.all([
    lerIdentidade(),
    obterKpis(),
    serieMensal(6),
    serieDiaria("receita", 30),
    porEtapa(),
    melhoresOportunidades(6),
    atividadeRecente(7),
    buscasRecentes(4),
  ]);
  const fuso = identidade.config.fuso || "America/Manaus";
  const primeiroNome = identidade.responsavel.split(" ")[0];
  const variacao =
    kpis.receitaMesAnteriorCentavos > 0
      ? Math.round(((kpis.receitaMesCentavos - kpis.receitaMesAnteriorCentavos) / kpis.receitaMesAnteriorCentavos) * 1000) / 10
      : null;

  const estatisticas = [
    { rotulo: "Leads encontrados", valor: kpis.leads, href: "/leads" },
    { rotulo: "Qualificados", valor: kpis.qualificados, href: "/leads?etapa=qualificado" },
    { rotulo: "Contatados", valor: kpis.contatados, href: "/crm" },
    { rotulo: "Respostas", valor: kpis.respostas, href: "/crm" },
    { rotulo: "Propostas", valor: kpis.propostas, href: "/crm" },
    { rotulo: "Vendas", valor: kpis.vendas, href: "/pagamentos" },
  ];

  return (
    <div className="space-y-6">
      <Entrada>
        <p className="text-sm text-muted-foreground">{hojePorExtenso(fuso)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {saudacao(fuso)}, {primeiroNome}.
        </h1>
        <p className="mt-1.5 text-[0.95rem] text-muted-foreground">
          Vamos encontrar sua próxima venda.
          {kpis.oportunidadesAltas > 0 && (
            <>
              {" "}
              Você tem{" "}
              <Link href="/leads?aba=abordar" className="font-semibold text-foreground underline decoration-brilho/50 underline-offset-4 hover:decoration-brilho">
                {kpis.oportunidadesAltas} {kpis.oportunidadesAltas === 1 ? "oportunidade de alta prioridade" : "oportunidades de alta prioridade"}
              </Link>{" "}
              esperando abordagem.
            </>
          )}
        </p>
      </Entrada>

      <Entrada atraso={0.06}>
        <BuscaRapida />
      </Entrada>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Bloco-herói: a receita, com o gráfico do mês e o funil comprimido. */}
        <Entrada atraso={0.1} className="heroi p-5 sm:p-6 xl:col-span-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="pastilha size-9">
                <Wallet className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-[0.95rem] font-semibold text-white">Receita</p>
                <p className="text-xs text-white/60">Este mês · vendas pagas</p>
              </div>
            </div>
            <Link href="/pagamentos" aria-label="Abrir pagamentos" className="flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20">
              <TrendingUp className="size-4" />
            </Link>
          </div>

          <div className="mt-6 grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div>
              <Contador valor={kpis.receitaMesCentavos} formato="moeda" className="block font-display text-5xl font-semibold tracking-tight text-white sm:text-[3.4rem]" />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {variacao !== null ? (
                  <span className={`rounded-full px-2 py-1 font-semibold ${variacao >= 0 ? "bg-sucesso/15 text-sucesso" : "bg-perigo/15 text-perigo"}`}>
                    {variacao >= 0 ? "+" : ""}
                    {variacao.toLocaleString("pt-BR")}% vs. mês anterior
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-white/70">Sem vendas no mês anterior para comparar</span>
                )}
                <span className="text-white/60">
                  Total: <Contador valor={kpis.receitaTotalCentavos} formato="moeda" className="font-semibold text-white/90" />
                </span>
              </div>
            </div>
            <GraficoArea pontos={receita30.map((p) => ({ rotulo: rotuloDia(p.dia), valor: p.valor }))} formato="moeda" altura={110} cor="#6fd3ff" titulo="Receita por dia (30 dias)" />
          </div>

          <Escalonado className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {estatisticas.map((e) => (
              <ItemEscalonado key={e.rotulo}>
                <Link href={e.href} className="block rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 transition-colors hover:border-white/25 hover:bg-white/10">
                  <p className="truncate text-[0.7rem] text-white/60">{e.rotulo}</p>
                  <Contador valor={e.valor} className="font-display text-xl font-semibold text-white" />
                </Link>
              </ItemEscalonado>
            ))}
          </Escalonado>
          <p className="mt-3 text-xs text-white/55">
            Taxa de conversão (vendas ÷ contatados):{" "}
            <span className="font-semibold text-white">{kpis.conversao === null ? "—" : `${kpis.conversao.toLocaleString("pt-BR")}%`}</span>
          </p>
        </Entrada>

        <Entrada atraso={0.14} className="xl:col-span-4">
          <Cartao icone={Flame} titulo="Oportunidades" subtitulo="Os leads com maior score, ainda não abordados" href="/leads?aba=abordar" className="h-full" corpoClassName="px-3 pb-3">
            {top.length === 0 ? (
              <Vazio icone={Radar} titulo="Nenhuma oportunidade ainda" descricao="Faça uma busca por categoria e localização para começar." acao={<BotaoBuscar />} className="py-8" />
            ) : (
              <ul className="space-y-1">
                {top.map((l) => (
                  <li key={l.lead_id}>
                    <Link href={`/leads/${l.lead_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
                      <AnelScore score={l.score} tamanho={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.categoria}
                          {l.cidade ? ` · ${l.cidade}` : ""}
                          {l.avaliacao_qtd ? ` · ${l.avaliacao_nota?.toFixed(1).replace(".", ",")}★ (${l.avaliacao_qtd})` : ""}
                        </p>
                      </div>
                      <SeloPresenca statusSite={l.status_site as StatusSite} qualidade={l.site_qualidade as QualidadeSite | null} className="hidden sm:inline-flex" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {buscas.length > 0 && <LimparBuscas />}
          </Cartao>
        </Entrada>
      </div>

      <Escalonado className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icone: Flame, rotulo: "Oportunidades", valor: kpis.oportunidadesAltas, detalhe: "alta prioridade", href: "/leads?aba=abordar" },
          { icone: MapPin, rotulo: "Leads encontrados", valor: kpis.leadsMes, detalhe: "neste mês", href: "/leads?ordem=recentes" },
          { icone: Megaphone, rotulo: "Campanhas", valor: kpis.campanhasAtivas, detalhe: `ativas · ${kpis.emailsEnviados.toLocaleString("pt-BR")} e-mails enviados`, href: "/campanhas" },
          { icone: Wallet, rotulo: "Receita", valor: kpis.receitaMesCentavos, detalhe: "no mês", href: "/pagamentos", moeda: true },
        ].map((c) => (
          <ItemEscalonado key={c.rotulo}>
            <Link href={c.href} className="placa group block p-4 transition-colors hover:border-brilho/40">
              <div className="flex items-center justify-between">
                <span className="pastilha-muda size-9">
                  <c.icone className="size-4" aria-hidden="true" />
                </span>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{c.rotulo}</p>
              <Contador valor={c.valor} formato={c.moeda ? "moeda" : "inteiro"} className="font-display text-2xl font-semibold" />
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.detalhe}</p>
            </Link>
          </ItemEscalonado>
        ))}
      </Escalonado>

      <div className="grid gap-5 lg:grid-cols-12">
        <Entrada atraso={0.05} className="lg:col-span-7">
          <Cartao icone={Activity} titulo="Últimos 6 meses" subtitulo="Leads encontrados e contatos feitos por mês" href="/analytics">
            <GraficoBarras
              titulo="Leads e contatos por mês"
              dados={mensal.map((m) => ({ rotulo: rotuloMes(m.mes), valores: { leads: m.leads, contatos: m.contatos } }))}
              series={[
                { chave: "leads", rotulo: "Leads", cor: "#3987e5" },
                { chave: "contatos", rotulo: "Contatos", cor: "#6fd3ff" },
              ]}
              altura={210}
            />
          </Cartao>
        </Entrada>
        <Entrada atraso={0.08} className="lg:col-span-5">
          <Cartao icone={TrendingUp} titulo="Funil" subtitulo="Onde estão os leads agora" href="/crm">
            <Funil
              titulo="Funil de vendas"
              etapas={[
                { rotulo: "Encontrados", valor: kpis.leads },
                { rotulo: "Qualificados", valor: kpis.qualificados },
                { rotulo: "Abordados", valor: kpis.contatados },
                { rotulo: "Responderam", valor: kpis.respostas },
                { rotulo: "Propostas", valor: kpis.propostas },
                { rotulo: "Fechados", valor: etapas.fechado },
              ]}
            />
          </Cartao>
        </Entrada>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Entrada className="lg:col-span-7">
          <Cartao icone={Sparkles} titulo="Atividade recente" subtitulo="Histórico de todos os leads" corpoClassName="px-3 pb-3">
            {atividade.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Quando você analisar, abordar ou fechar um lead, aparece aqui.</p>
            ) : (
              <ul className="space-y-0.5">
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
        <Entrada className="lg:col-span-5">
          <Cartao icone={Search} titulo="Buscas recentes" href="/buscar" corpoClassName="px-3 pb-3">
            {buscas.length === 0 ? (
              <Vazio icone={Mail} titulo="Nenhuma busca ainda" descricao="Sua primeira busca aparece aqui, com quantas empresas trouxe." acao={<BotaoBuscar />} className="py-8" />
            ) : (
              <ul className="space-y-0.5">
                {buscas.map((b) => (
                  <li key={b.id}>
                    <Link href={`/buscar?busca=${b.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{b.consulta_natural ?? `${b.segmento}${b.cidade ? ` em ${b.cidade}` : ""}`}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.provedor === "google_places" ? "Google Maps" : "OpenStreetMap"} · {haQuantoTempo(b.criado_em)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block font-semibold num">{b.quantidade_encontrada}</span>
                        <span className="text-muted-foreground">{b.status === "concluida" ? `${b.quantidade_nova} novas` : b.status === "erro" ? "erro" : "em andamento"}</span>
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
    </div>
  );
}

function BotaoBuscar() {
  return (
    <Link href="/buscar" className="inline-flex h-10 items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(51,102,255,0.9)] hover:bg-brilho">
      <Search className="size-4" /> Buscar novas oportunidades
    </Link>
  );
}
