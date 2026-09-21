import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, BadgeCheck, Camera, MessageCircle, Sparkles } from "lucide-react";

import { ObservacaoLead } from "@/app/(painel)/funil/observacao";
import { BadgeScore } from "@/components/leads/acao-lead";
import { BotaoGerarAbordagem } from "@/components/leads/botao-gerar-abordagem";
import { LinkContato } from "@/components/leads/link-contato";
import { SeletorEtapa } from "@/components/leads/seletor-etapa";
import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { funilPorSegmento, listarFunil, resumoFunil, type CartaoFunil } from "@/db/funil";
import type { StatusLead } from "@/db/tipos";
import { CLASSE_ETAPA, ETAPAS, ROTULO_ETAPA, haQuantoTempo } from "@/lib/leads/etapas";
import { linkInstagram } from "@/lib/leads/redes";
import { montarLinkWhatsApp } from "@/lib/leads/whatsapp";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Funil" };
export const dynamic = "force-dynamic";

/** O que cada coluna espera do operador. Fica no topo da coluna, não num manual. */
const DICA: Record<StatusLead, string> = {
  novo: "Analisados ou marcados à mão, ainda sem abordagem.",
  contatado: "Você abriu o WhatsApp ou o e-mail. Sem resposta ainda.",
  respondeu: "Conversa em andamento. Anote o que combinou.",
  fechado: "Registre a venda para entrar no faturamento.",
  nao_interessado: "Sem interesse agora. Vale voltar em alguns meses.",
};

export default async function PaginaFunil() {
  const [colunas, resumo, porSegmento] = await Promise.all([listarFunil(), resumoFunil(), funilPorSegmento()]);
  const total = ETAPAS.reduce((s, e) => s + resumo.porEtapa[e], 0);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        olho="Acompanhamento"
        titulo="Funil"
        descricao="Cada lead numa etapa. Abrir o WhatsApp ou o e-mail já marca como contatado; o resto é um clique no chip."
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="No funil" valor={total.toLocaleString("pt-BR")} detalhe="leads com etapa" />
        <Metrica
          rotulo="Taxa de resposta"
          valor={resumo.taxaResposta === null ? "—" : `${resumo.taxaResposta}%`}
          detalhe="responderam ou fecharam, entre os contatados"
        />
        <Metrica
          rotulo="Taxa de fechamento"
          valor={resumo.taxaFechamento === null ? "—" : `${resumo.taxaFechamento}%`}
          detalhe="fecharam, entre os contatados"
        />
        <Metrica rotulo="Vendido pelo funil" valor={formatarDinheiro(resumo.fechado_centavos)} detalhe="vendas pagas ligadas a leads" destaque />
      </dl>

      {total === 0 ? (
        <div className="vidro flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
          <p className="font-medium">Nenhum lead no funil ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Um lead entra aqui quando é analisado pela IA ou quando você muda a etapa dele na tela
            de Empresas. Abrir o WhatsApp de uma empresa já a coloca em “Contatado”.
          </p>
          <Button render={<Link href="/empresas" />} nativeButton={false} className="mt-1 h-11 cursor-pointer">
            Ir para Empresas
          </Button>
        </div>
      ) : (
        // Cinco colunas lado a lado no desktop; no celular rolam na
        // horizontal, cada uma com a largura de um cartão. É o único
        // lugar do site com rolagem horizontal, e é dentro deste bloco.
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[64rem] grid-cols-5 gap-3">
            {ETAPAS.map((etapa) => (
              <section key={etapa} aria-label={ROTULO_ETAPA[etapa]} className="flex min-w-0 flex-col gap-2">
                <header className="flex items-baseline justify-between gap-2 px-1">
                  <h2 className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", CLASSE_ETAPA[etapa])}>
                    {ROTULO_ETAPA[etapa]}
                    <span className="num opacity-80">{resumo.porEtapa[etapa]}</span>
                  </h2>
                </header>
                <p className="px-1 text-[0.7rem] leading-snug text-muted-foreground">{DICA[etapa]}</p>

                <ul className="flex flex-col gap-2">
                  {colunas[etapa].map((c) => (
                    <Cartao key={c.lead_id} c={c} />
                  ))}
                  {resumo.porEtapa[etapa] > colunas[etapa].length && (
                    <li className="px-1 text-xs text-muted-foreground">
                      + {resumo.porEtapa[etapa] - colunas[etapa].length} mais —{" "}
                      <Link href={`/empresas?etapa=${etapa}`} className="underline underline-offset-4">
                        ver em Empresas
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {porSegmento.length > 0 && (
        <section aria-label="Por segmento" className="vidro rounded-xl p-5">
          <p className="olho-mudo">Onde está rendendo</p>
          <h2 className="mt-1 text-lg font-semibold">Resposta e fechamento por segmento</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Segmento</th>
                  <th className="num py-2 pr-4 text-right font-medium">Contatados</th>
                  <th className="num py-2 pr-4 text-right font-medium">Responderam</th>
                  <th className="num py-2 pr-4 text-right font-medium">Fecharam</th>
                  <th className="num py-2 text-right font-medium">Fechamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {porSegmento.map((s) => (
                  <tr key={s.categoria}>
                    <td className="py-2 pr-4">{rotuloDoSegmento(s.categoria)}</td>
                    <td className="num py-2 pr-4 text-right">{s.contatados}</td>
                    <td className="num py-2 pr-4 text-right">{s.responderam}</td>
                    <td className="num py-2 pr-4 text-right">{s.fechados}</td>
                    <td className="num py-2 text-right font-semibold">
                      {Math.round((s.fechados / s.contatados) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Metrica({ rotulo, valor, detalhe, destaque = false }: { rotulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="vidro brasa rounded-xl p-4">
      <dt className="olho-mudo">{rotulo}</dt>
      <dd className={cn("num mt-2 text-2xl font-semibold tracking-tight", destaque && "text-acento")}>{valor}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{detalhe}</dd>
    </div>
  );
}

function Cartao({ c }: { c: CartaoFunil }) {
  const zap = montarLinkWhatsApp(c.telefone, c.mensagem_gerada ?? "", c.pais);
  const tempo = haQuantoTempo(c.status_em);
  const local = [c.cidade, c.estado].filter(Boolean).join(", ");

  return (
    <li className="vidro brasa flex flex-col gap-2 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={c.nome}>{c.nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {rotuloDoSegmento(c.categoria)}
            {local ? ` · ${local}` : ""}
          </p>
        </div>
        <BadgeScore score={c.score_oportunidade} />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {zap && (
          <LinkContato
            href={zap}
            empresaId={c.empresa_id}
            title="WhatsApp"
            className="inline-flex size-9 items-center justify-center rounded-md text-emerald-300 hover:bg-emerald-400/10"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span className="sr-only">WhatsApp de {c.nome}</span>
          </LinkContato>
        )}
        {c.email && (
          <LinkContato
            href={`mailto:${c.email}${c.mensagem_gerada ? `?body=${encodeURIComponent(c.mensagem_gerada)}` : ""}`}
            empresaId={c.empresa_id}
            title={c.email}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <AtSign className="size-4" aria-hidden="true" />
            <span className="sr-only">E-mail de {c.nome}</span>
          </LinkContato>
        )}
        {linkInstagram(c.instagram) && (
          <a
            href={linkInstagram(c.instagram)!}
            target="_blank"
            rel="noopener noreferrer"
            title="Instagram"
            className="inline-flex size-9 items-center justify-center rounded-md text-pink-300 hover:bg-pink-400/10"
          >
            <Camera className="size-4" aria-hidden="true" />
            <span className="sr-only">Instagram de {c.nome}</span>
          </a>
        )}
        {c.mensagem_gerada ? (
          <span title="Mensagem da IA pronta" className="inline-flex size-9 items-center justify-center text-muted-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <BotaoGerarAbordagem empresaId={c.empresa_id} className="h-9 px-2" />
        )}
        <span className="ml-auto text-[0.7rem] text-muted-foreground">{tempo}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <SeletorEtapa empresaId={c.empresa_id} etapa={c.status} />
        {c.status === "fechado" &&
          (c.vendido_centavos > 0 ? (
            <span className="num inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {formatarDinheiro(c.vendido_centavos)}
            </span>
          ) : (
            <Link
              href={`/vendas?lead=${c.lead_id}&empresa=${encodeURIComponent(c.nome)}`}
              className="text-xs font-medium text-acento underline-offset-4 hover:underline"
            >
              Registrar venda
            </Link>
          ))}
      </div>

      <ObservacaoLead empresaId={c.empresa_id} observacao={c.observacao} />
    </li>
  );
}
