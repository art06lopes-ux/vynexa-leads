import { ArrowRight, BookOpen, Check } from "lucide-react";
import Link from "next/link";

import { getBanco } from "@/db/cliente";
import { cn } from "@/lib/utils";

/**
 * Lista de primeiros passos do assinante novo. Cada item confere no banco
 * da conta se já foi feito; quando todos estão feitos, o cartão some.
 */
export async function PrimeirosPassos({ temGoogle, bemVindo }: { temGoogle: boolean; bemVindo: boolean }) {
  const { rows } = await getBanco().execute(`SELECT
      (SELECT COUNT(*) FROM configuracoes WHERE chave = 'empresa_whatsapp' AND TRIM(valor) <> '') AS whats,
      (SELECT COUNT(*) FROM produtos WHERE ativo = 1) AS produtos,
      (SELECT COUNT(*) FROM buscas) AS buscas,
      (SELECT COUNT(*) FROM leads WHERE contatado_em IS NOT NULL) AS abordados,
      (SELECT COUNT(*) FROM push_assinaturas WHERE invalidada_em IS NULL) AS push,
      (SELECT COUNT(*) FROM integracoes WHERE chave = 'GOOGLE_PLACES_API_KEY') AS google`);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);

  const passos = [
    { feito: n("whats") > 0, titulo: "Complete a sua identidade", texto: "Nome, WhatsApp e site vão nas mensagens.", href: "/configuracoes?aba=identidade" },
    { feito: n("produtos") > 0, titulo: "Cadastre o que você vende", texto: "A IA usa para sugerir a oferta certa.", href: "/configuracoes?aba=produtos" },
    ...(temGoogle ? [{ feito: n("google") > 0, titulo: "Conecte a sua chave do Google", texto: "Para buscar no Google Maps. Leva 10 minutos.", href: "/tutoriais/chave-google" }] : []),
    { feito: n("buscas") > 0, titulo: "Faça a primeira busca no Radar", texto: "Escolha um nicho e marque a área no mapa.", href: "/buscar" },
    { feito: n("abordados") > 0, titulo: "Aborde o primeiro lead", texto: "Abra um lead e toque em WhatsApp.", href: "/leads?situacao=nao_abordados" },
    { feito: n("push") > 0, titulo: "Ative os avisos no celular", texto: "Saiba na hora quando alguém responde.", href: "/configuracoes?aba=avancado" },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section className="placa overflow-hidden" aria-labelledby="titulo-primeiros-passos">
      <div className="flex flex-wrap items-center gap-3 border-b border-fio px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-primeiros-passos" className="font-display text-base font-semibold">
            {bemVindo ? "Bem-vindo! Vamos deixar tudo pronto" : "Primeiros passos"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {feitos} de {passos.length} feitos
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos} aria-label="Progresso">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ff7a45] to-[#ffb347]" style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
        <Link href="/tutoriais/primeiros-passos" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio px-3 text-xs font-semibold hover:border-brilho/40">
          <BookOpen className="size-3.5" aria-hidden="true" /> Tutorial
        </Link>
      </div>
      <ol className="grid grid-cols-1 divide-y divide-fio sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
        {passos.map((p) => (
          <li key={p.titulo}>
            <Link href={p.href} className={cn("flex h-full items-start gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]", p === proximo && "bg-azul/[0.06]")}>
              <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border", p.feito ? "border-sucesso/50 bg-sucesso/15 text-sucesso" : "border-fio text-transparent")}>
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", p.feito && "text-muted-foreground line-through decoration-white/30")}>{p.titulo}</span>
                <span className="block text-xs text-muted-foreground">{p.texto}</span>
              </span>
              {p === proximo && <ArrowRight className="mt-1 size-4 shrink-0 text-ciano" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
