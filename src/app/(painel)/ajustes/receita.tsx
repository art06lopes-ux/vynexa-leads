import { Database, ExternalLink } from "lucide-react";

import { FormularioReceita } from "@/app/(painel)/ajustes/formulario-receita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumoReceita } from "@/db/receita";

const ACTIONS = "https://github.com/art06lopes-ux/vynexa-leads/actions/workflows/receita.yml";

const STATUS = {
  em_andamento: { rotulo: "importando", classe: "text-amber-300" },
  concluida: { rotulo: "concluída", classe: "text-emerald-300" },
  erro: { rotulo: "falhou", classe: "text-destructive" },
} as const;

/**
 * Card da base da Receita Federal.
 *
 * Mostra o que existe na base (por estado), a referência importada e a
 * lista de estados a importar. A importação em si roda no GitHub
 * Actions — o link daqui só leva até lá, porque uma função da Vercel
 * não sobrevive aos 40 minutos que os 5 GB da Receita levam.
 */
export function CardReceita({ resumo, ufs }: { resumo: ResumoReceita; ufs: string }) {
  const total = resumo.porUf.reduce((s, u) => s + u.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4 text-muted-foreground" aria-hidden="true" />
          Base de CNPJs da Receita Federal
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Dados abertos, oficiais e gratuitos: telefone e e-mail cadastrados de todo
          estabelecimento ativo. As caçadas no Brasil usam esta base para preencher o contato
          das empresas que o OpenStreetMap só localiza — e para encontrar as que ele nem
          conhece. Só entra o que a Receita registra; cada campo mostra de onde veio.
        </p>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-black/20 px-4 py-3">
            <dt className="olho-mudo">Na base</dt>
            <dd className="num mt-1 text-2xl font-semibold">{total.toLocaleString("pt-BR")}</dd>
            <dd className="text-xs text-muted-foreground">estabelecimentos ativos</dd>
          </div>
          <div className="rounded-lg border border-border bg-black/20 px-4 py-3">
            <dt className="olho-mudo">Referência</dt>
            <dd className="num mt-1 text-2xl font-semibold">{resumo.referencia ?? "—"}</dd>
            <dd className="text-xs text-muted-foreground">pasta mensal da Receita</dd>
          </div>
          <div className="rounded-lg border border-border bg-black/20 px-4 py-3">
            <dt className="olho-mudo">Estados importados</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {resumo.porUf.length === 0 ? "—" : resumo.porUf.map((u) => u.uf).join(", ")}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {resumo.porUf.map((u) => `${u.uf} ${u.total.toLocaleString("pt-BR")}`).join(" · ") ||
                "nenhum ainda"}
            </dd>
          </div>
        </dl>

        <FormularioReceita ufs={ufs} />

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm">
          <p className="font-medium">Como importar</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Salve os estados acima.</li>
            <li>
              Abra o fluxo <em>receita</em> no GitHub e clique em <em>Run workflow</em>. Leva de
              20 a 60 minutos; esta tela mostra o andamento.
            </li>
            <li>Depois disso, ele repete sozinho todo dia 15 com a pasta mais nova da Receita.</li>
          </ol>
          <a
            href={ACTIONS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-acento underline-offset-4 hover:underline"
          >
            Abrir o fluxo no GitHub
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>

        {resumo.ultimas.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {resumo.ultimas.map((i) => {
              const st = STATUS[i.status];
              return (
                <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                  <span className="num w-20 text-muted-foreground">{i.referencia}</span>
                  <span className="font-medium">{i.uf}</span>
                  <span className={st.classe}>{st.rotulo}</span>
                  {i.status === "concluida" && (
                    <span className="num text-muted-foreground">
                      {i.linhas.toLocaleString("pt-BR")} linhas
                    </span>
                  )}
                  {i.erro && <span className="min-w-0 flex-1 truncate text-destructive">{i.erro}</span>}
                  <span className="num ml-auto text-xs text-muted-foreground">
                    {i.iniciado_em.slice(0, 16)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
