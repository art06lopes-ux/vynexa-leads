import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listarCampanhas, type Campanha } from "@/db/campanhas";
import { contaConectada } from "@/lib/google/oauth";

export const metadata: Metadata = { title: "Campanhas" };
export const dynamic = "force-dynamic";

const ROTULO: Record<Campanha["status"], { texto: string; classe: string }> = {
  rascunho: { texto: "Escrevendo e-mails", classe: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  em_envio: { texto: "Enviando", classe: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  pausada: { texto: "Pausada", classe: "border-slate-400/25 bg-slate-400/10 text-slate-300" },
  concluida: { texto: "Concluída", classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
};

export default async function PaginaCampanhas() {
  const [campanhas, conta] = await Promise.all([listarCampanhas(), contaConectada()]);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        olho="Abordagem por e-mail"
        titulo="Campanhas"
        descricao="Cada campanha escreve um e-mail por empresa com a IA e envia pelo seu Gmail, com pausa entre envios e teto de 100 por dia."
        acoes={
          <Button
            render={<Link href="/empresas?temEmail=sim" />}
            nativeButton={false}
            className="h-11 cursor-pointer gap-2"
          >
            <Mail className="size-4" aria-hidden="true" />
            Escolher empresas
          </Button>
        }
      />

      {conta === null && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          Nenhuma conta Google conectada. Vá em{" "}
          <Link href="/ajustes" className="cursor-pointer underline underline-offset-2">
            Ajustes
          </Link>{" "}
          e conecte o Gmail antes de criar campanhas.
        </p>
      )}

      {campanhas.length === 0 ? (
        <Card className="vidro">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-16 items-center justify-center rounded-lg border border-border bg-black/25">
              <Mail className="size-7 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="font-medium">Nenhuma campanha ainda</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Em Empresas, marque as caixas de quem tem e-mail e clique em &ldquo;Criar
              campanha&rdquo;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {campanhas.map((c) => {
            const st = ROTULO[c.status];
            const pct = c.total_leads > 0 ? Math.round((c.enviados / c.total_leads) * 100) : 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/campanhas/${c.id}`}
                  className="vidro brasa block cursor-pointer rounded-xl p-5 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="olho-mudo">{c.criado_em.slice(0, 10)}</p>
                      <p className="mt-1 truncate text-base font-semibold">{c.nome}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${st.classe}`}
                    >
                      {st.texto}
                    </span>
                  </div>

                  <div className="num mt-4 flex items-baseline gap-4 text-sm text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">{c.enviados}</span> / {c.total_leads}{" "}
                      enviados
                    </span>
                    {c.falhas > 0 && <span className="text-destructive">{c.falhas} falha(s)</span>}
                  </div>

                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-acento"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
