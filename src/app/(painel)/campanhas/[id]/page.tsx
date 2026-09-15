import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, PenLine, XCircle } from "lucide-react";

import { BotaoPausa } from "@/app/(painel)/campanhas/[id]/botao-pausa";
import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { CartaoContador } from "@/components/painel/cartao-contador";
import { Card, CardContent } from "@/components/ui/card";
import { obterCampanha, type EnvioListado } from "@/db/campanhas";
import { nomeDoPais } from "@/lib/geo/paises";

export const metadata: Metadata = { title: "Campanha" };
export const dynamic = "force-dynamic";

const STATUS: Record<
  EnvioListado["status"],
  { texto: string; classe: string; Icone: typeof Clock }
> = {
  pendente: { texto: "Escrevendo", classe: "text-sky-300", Icone: PenLine },
  na_fila: { texto: "Na fila", classe: "text-amber-300", Icone: Clock },
  enviado: { texto: "Enviado", classe: "text-emerald-300", Icone: CheckCircle2 },
  erro: { texto: "Falhou", classe: "text-destructive", Icone: XCircle },
};

export default async function PaginaCampanha({ params }: PageProps<"/campanhas/[id]">) {
  const { id } = await params;
  const dados = await obterCampanha(id);
  if (!dados) notFound();

  const { campanha, envios } = dados;
  const naFila = envios.filter((e) => e.status === "na_fila").length;
  const escrevendo = envios.filter((e) => e.status === "pendente").length;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        olho={`Campanha · ${campanha.criado_em.slice(0, 10)}`}
        titulo={campanha.nome}
        descricao={campanha.descricao ?? undefined}
        acoes={<BotaoPausa id={campanha.id} status={campanha.status} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoContador
          rotulo="Enviados"
          valor={campanha.enviados}
          formato="inteiro"
          tom="bom"
          detalhe={`de ${campanha.total_leads}`}
        />
        <CartaoContador
          rotulo="Na fila"
          valor={naFila}
          formato="inteiro"
          tom="atencao"
          detalhe="prontos, aguardando envio"
        />
        <CartaoContador
          rotulo="Escrevendo"
          valor={escrevendo}
          formato="inteiro"
          tom="info"
          detalhe="a IA ainda não redigiu"
        />
        <CartaoContador
          rotulo="Falhas"
          valor={campanha.falhas}
          formato="inteiro"
          tom={campanha.falhas > 0 ? "neon" : "neutro"}
        />
      </div>

      <Card className="vidro">
        <CardContent className="pt-2">
          <ul className="divide-y divide-border">
            {envios.map((e) => {
              const st = STATUS[e.status];
              return (
                <li key={e.id} className="py-3.5">
                  {/* <details> nativo: abre o e-mail sem JavaScript, e o
                      operador confere o texto antes de o envio acontecer. */}
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.empresa_nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.email ?? "sem e-mail"} · {nomeDoPais(e.pais)}
                        </p>
                      </div>
                      {e.assunto && (
                        <p className="hidden max-w-xs truncate text-sm text-muted-foreground md:block">
                          {e.assunto}
                        </p>
                      )}
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${st.classe}`}
                      >
                        <st.Icone className="size-3.5" aria-hidden="true" />
                        {st.texto}
                        {e.enviado_em && (
                          <span className="num text-muted-foreground"> · {e.enviado_em.slice(5, 16)}</span>
                        )}
                      </span>
                    </summary>

                    {(e.corpo || e.erro) && (
                      <div className="mt-3 rounded-lg border border-border bg-black/25 p-3 text-sm">
                        {e.assunto && <p className="mb-2 font-medium">{e.assunto}</p>}
                        {e.corpo && (
                          <p className="whitespace-pre-wrap text-muted-foreground">{e.corpo}</p>
                        )}
                        {e.erro && <p className="mt-2 text-destructive">{e.erro}</p>}
                      </div>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
