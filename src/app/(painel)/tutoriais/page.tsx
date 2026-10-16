import { BookOpen, Clock, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Cabecalho } from "@/components/base/cartao";
import { tutoriaisVisiveis, type Tutorial } from "@/lib/tutoriais";
import { lerConfigSaas } from "@/services/admin";
import { exigirSessao } from "@/server/sessao";

export const metadata = { title: "Tutoriais" };

const ORDEM: Tutorial["grupo"][] = ["Comece aqui", "Prospecção", "Chaves e integrações", "Conta"];

export default async function PaginaTutoriais() {
  const sessao = await exigirSessao();
  const lista = tutoriaisVisiveis(sessao.ehDono);
  const { whatsappSuporte } = await lerConfigSaas().catch(() => ({ whatsappSuporte: "" }));
  const [destaque, ...resto] = lista;

  return (
    <div>
      <Cabecalho icone={BookOpen} secao="Ajuda" titulo="Tutoriais" descricao="Passo a passo curto para cada parte do sistema. Comece pelos primeiros passos e volte aqui quando travar." />

      <Link href={`/tutoriais/${destaque.slug}`} className="placa group mb-8 flex flex-col gap-4 border-brilho/40 p-6 transition-colors hover:border-brilho/70 sm:flex-row sm:items-center">
        <span className="pastilha size-12 shrink-0">
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-semibold">{destaque.titulo}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{destaque.resumo}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" /> {destaque.minutos} min
        </span>
      </Link>

      <div className="space-y-8">
        {ORDEM.filter((g) => g !== "Comece aqui").map((grupo) => {
          const itens = resto.filter((t) => t.grupo === grupo);
          if (itens.length === 0) return null;
          return (
            <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
              <h2 id={`grupo-${grupo}`} className="mb-3 font-display text-lg font-semibold">
                {grupo}
              </h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {itens.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/tutoriais/${t.slug}`} className="placa flex h-full flex-col p-5 transition-colors hover:border-brilho/50">
                      <span className="font-semibold">{t.titulo}</span>
                      <span className="mt-1 flex-1 text-sm text-muted-foreground">{t.resumo}</span>
                      <span className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden="true" /> {t.minutos} min · {t.passos.length} passos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {whatsappSuporte && !sessao.ehDono && (
        <a href={`https://wa.me/${whatsappSuporte}`} target="_blank" rel="noreferrer" className="mt-10 inline-flex h-11 items-center gap-2 rounded-xl border border-fio px-4 text-sm font-semibold hover:border-brilho/40">
          <MessageCircle className="size-4" aria-hidden="true" /> Não achou? Fale com o suporte no WhatsApp
        </a>
      )}
    </div>
  );
}
