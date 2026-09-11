import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listarBuscasRecentes } from "@/db/consultas";
import { nomeDoPais } from "@/lib/geo/paises";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";
import type { Busca } from "@/db/tipos";

export const metadata: Metadata = { title: "Histórico" };
export const dynamic = "force-dynamic";

const ROTULO: Record<Busca["status"], { texto: string; classe: string }> = {
  pendente: { texto: "Na fila", classe: "border-slate-400/25 bg-slate-400/10 text-slate-300" },
  em_andamento: { texto: "Rastreando", classe: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  concluida: { texto: "Concluída", classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  erro: { texto: "Erro", classe: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export default async function PaginaHistorico() {
  const buscas = await listarBuscasRecentes(60);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Histórico de caçadas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda busca já executada, com região resolvida, alcance final e quanto veio de novo.
        </p>
      </header>

      {buscas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Radar className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma caçada ainda</p>
            <Button render={<Link href="/buscar" />} className="mt-2 h-11 cursor-pointer">
              Fazer a primeira
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Segmento</th>
                <th scope="col" className="px-4 py-3 font-medium">Região</th>
                <th scope="col" className="px-4 py-3 font-medium">Alcance</th>
                <th scope="col" className="px-4 py-3 font-medium">Resultado</th>
                <th scope="col" className="px-4 py-3 font-medium">Quando</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {buscas.map((b) => {
                const status = ROTULO[b.status];
                const local = [b.cidade, b.estado, nomeDoPais(b.pais)].filter(Boolean).join(", ");

                return (
                  <tr key={b.id} className="transition-colors duration-200 hover:bg-accent/40">
                    <td className="px-4 py-3 font-medium">{rotuloDoSegmento(b.segmento)}</td>

                    <td className="max-w-56 px-4 py-3 text-muted-foreground">
                      <p className="truncate">{local}</p>
                      {b.rotulo_resolvido && (
                        <p className="truncate text-xs opacity-70">{b.rotulo_resolvido}</p>
                      )}
                    </td>

                    <td className="num px-4 py-3 text-muted-foreground">
                      {b.raio_final_km !== null ? `${b.raio_final_km} km` : "—"}
                      {b.expansoes > 0 && (
                        <span className="block text-xs opacity-70">
                          {b.expansoes} expansão{b.expansoes > 1 ? "ões" : ""}
                        </span>
                      )}
                    </td>

                    <td className="num px-4 py-3">
                      {b.status === "concluida" ? (
                        <>
                          <span className="font-medium">{b.quantidade_encontrada}</span>
                          <span className="text-muted-foreground"> achadas · </span>
                          <span className="font-medium text-emerald-300">{b.quantidade_nova}</span>
                          <span className="text-muted-foreground"> novas</span>
                        </>
                      ) : b.status === "erro" && b.erro ? (
                        <span className="line-clamp-2 text-xs text-destructive" title={b.erro}>
                          {b.erro}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="num px-4 py-3 text-xs text-muted-foreground">
                      {b.criado_em.slice(0, 16).replace("T", " ")}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${status.classe}`}
                      >
                        {b.status === "erro" && (
                          <CircleAlert className="mr-1.5 size-3.5" aria-hidden="true" />
                        )}
                        {status.texto}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
