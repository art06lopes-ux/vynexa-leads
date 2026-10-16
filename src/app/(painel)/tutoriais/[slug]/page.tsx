import { ArrowRight, BookOpen, Clock, ExternalLink, Lightbulb } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/base/cartao";
import { tutoriaisVisiveis } from "@/lib/tutoriais";
import { exigirSessao } from "@/server/sessao";

/** Converte um link do YouTube no endereço de incorporação (sem cookies). */
function embedYoutube(url: string): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/.exec(url);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export async function generateMetadata({ params }: PageProps<"/tutoriais/[slug]">) {
  const { slug } = await params;
  const t = tutoriaisVisiveis(true).find((x) => x.slug === slug);
  return { title: t?.titulo ?? "Tutorial" };
}

export default async function PaginaTutorial({ params }: PageProps<"/tutoriais/[slug]">) {
  const sessao = await exigirSessao();
  const { slug } = await params;
  const lista = tutoriaisVisiveis(sessao.ehDono);
  const i = lista.findIndex((t) => t.slug === slug);
  if (i < 0) notFound();
  const t = lista[i];
  const proximo = lista[i + 1];
  const video = t.video ? embedYoutube(t.video) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho icone={BookOpen} titulo={t.titulo} trilha={[{ href: "/tutoriais", rotulo: "Tutoriais" }]} descricao={t.resumo} />
      <p className="-mt-3 mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="size-4" aria-hidden="true" /> {t.minutos} min
      </p>

      {video && (
        <div className="mb-8 aspect-video overflow-hidden rounded-2xl border border-fio bg-black">
          <iframe src={video} title={t.titulo} className="size-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}

      <ol className="space-y-4">
        {t.passos.map((p, n) => (
          <li key={p.titulo} className="placa flex gap-4 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#ff7a45] to-[#e8470f] font-display text-sm font-bold text-sobre-brasa">{n + 1}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold">{p.titulo}</h2>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{p.texto}</p>
              {p.dica && (
                <p className="mt-3 flex gap-2 rounded-xl bg-aviso/[0.08] p-3 text-sm text-aviso">
                  <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {p.dica}
                </p>
              )}
              {p.link &&
                (p.link.href.startsWith("http") ? (
                  <a href={p.link.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ciano underline-offset-2 hover:underline">
                    {p.link.rotulo} <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <Link href={p.link.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ciano underline-offset-2 hover:underline">
                    {p.link.rotulo} <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ))}
            </div>
          </li>
        ))}
      </ol>

      {proximo && (
        <Link href={`/tutoriais/${proximo.slug}`} className="placa mt-8 flex items-center gap-4 p-5 transition-colors hover:border-brilho/50">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Próximo</span>
            <span className="block font-semibold">{proximo.titulo}</span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
