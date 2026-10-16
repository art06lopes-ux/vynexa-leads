import { ArrowUpRight, Globe2, History, MapPinned, Radar, Target } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AvisoConfiguracao, Cabecalho } from "@/components/base/cartao";
import { LimparBuscas } from "@/components/dashboard/limpar-buscas";
import { Contador } from "@/components/motion/contador";
import { TelaRadar } from "@/components/radar/tela-radar";
import { getBanco } from "@/db/cliente";
import { buscasRecentes, obterKpis } from "@/db/painel";
import { estadoDosProvedores } from "@/integrations/leads";
import { haQuantoTempo } from "@/services/crm";
import { usoGoogle } from "@/services/cota-google";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Radar" };

export default async function PaginaRadar({ searchParams }: PageProps<"/buscar">) {
  const { busca } = await searchParams;
  const sessao = await exigirSessao();
  const planoGoogle = sessao.recursos.includes("radar_google");
  const banco = getBanco();
  const [provedores, uso, teto, kpis, buscas] = await Promise.all([
    estadoDosProvedores(),
    usoGoogle(banco),
    banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'google_teto_requisicoes'`).then(({ rows }) => Number(rows[0]?.valor ?? 10) || 10),
    obterKpis(),
    buscasRecentes(12),
  ]);
  const googleOk = provedores.find((p) => p.nome === "google_places")?.disponivel ?? false;
  const iniciais = typeof busca === "string" ? busca.split(",").filter((s) => /^[\w-]{6,64}$/.test(s)).slice(0, 3) : [];

  return (
    <div className="space-y-6">
      <Cabecalho
        icone={Radar}
        secao="Prospecção"
        titulo="Radar"
        descricao={planoGoogle ? "Marque o território, diga o que procura e o Radar varre o Google Maps ou o OpenStreetMap: cada empresa chega com a presença digital avaliada e a oportunidade calculada." : "Marque o território, escolha o segmento e o Radar varre o OpenStreetMap: cada empresa chega com a presença digital avaliada e a oportunidade calculada."}
        numeros={[
          ...(planoGoogle ? [{ valor: <Contador valor={uso.restantes} />, rotulo: "consultas Google restantes no mês" }] : []),
          { valor: <Contador valor={kpis.leads} />, rotulo: "empresas mapeadas" },
          { valor: <Contador valor={kpis.semSite} />, rotulo: "sem website" },
        ]}
      />
      {planoGoogle && !googleOk && (
        <AvisoConfiguracao titulo="Google Maps ainda não configurado">
          Para buscar no Google Maps, cole a sua chave da Google Places API em Configurações → Integrações (passo a passo em Tutoriais). Enquanto isso, o OpenStreetMap funciona sem chave.
        </AvisoConfiguracao>
      )}

      <Suspense>
        <TelaRadar googleOk={googleOk} planoGoogle={planoGoogle} uso={uso} tetoPadrao={teto} buscasIniciais={iniciais} />
      </Suspense>

      <section aria-labelledby="titulo-capturadas" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-capturadas" className="text-xl font-semibold">
              Oportunidades capturadas
            </h2>
            <p className="text-sm text-muted-foreground">Tudo o que o Radar já trouxe para a sua carteira.</p>
          </div>
          <Link href="/leads" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-fio bg-placa px-3.5 text-sm font-semibold hover:border-brilho/40">
            Abrir Leads <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icone: MapPinned, rotulo: "Mapeadas", valor: kpis.leads, href: "/leads", nota: "empresas na carteira" },
            { icone: Target, rotulo: "Alta aderência", valor: kpis.oportunidadesAltas, href: "/leads?situacao=nao_abordados&ordem=score", nota: "prioridade alta, ainda não abordadas" },
            { icone: Globe2, rotulo: "Sem website", valor: kpis.semSite, href: "/leads?site=sem", nota: "só redes sociais ou nada" },
          ].map((c) => (
            <Link key={c.rotulo} href={c.href} className="placa group flex items-center gap-4 p-5 transition-colors hover:border-brilho/40">
              <span className="pastilha size-11 shrink-0">
                <c.icone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold text-muted-foreground">{c.rotulo}</dt>
                <dd>
                  <Contador valor={c.valor} className="font-display text-3xl font-semibold" />
                </dd>
                <p className="text-[0.72rem] text-muted-foreground">{c.nota}</p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brilho" />
            </Link>
          ))}
        </dl>
      </section>

      <section aria-labelledby="titulo-buscas-salvas" className="placa p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="size-5 text-brilho" />
            <div>
              <h2 id="titulo-buscas-salvas" className="font-semibold">
                Buscas salvas
              </h2>
              <p className="text-xs text-muted-foreground">Cada varredura fica guardada — abra para rever o resultado.</p>
            </div>
          </div>
          {buscas.length > 0 && <LimparBuscas />}
        </div>
        {buscas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sua primeira varredura aparece aqui.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {buscas.map((b) => (
              <li key={b.id}>
                <Link href={`/buscar?busca=${b.id}`} className="flex items-center gap-3 rounded-xl border border-fio bg-tinta/50 px-3.5 py-3 text-sm transition-colors hover:border-brilho/40">
                  <span className={b.status === "erro" ? "size-2 shrink-0 rounded-full bg-perigo" : b.status === "concluida" ? "size-2 shrink-0 rounded-full bg-sucesso" : "size-2 shrink-0 animate-pulse rounded-full bg-aviso"} aria-hidden="true" />
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
      </section>
    </div>
  );
}
