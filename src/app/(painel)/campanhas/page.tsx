import { Megaphone, Plus } from "lucide-react";
import Link from "next/link";

import { AbasPagina } from "@/components/base/abas-pagina";
import { Cabecalho, Vazio } from "@/components/base/cartao";
import { COR_CAMPANHA, ROTULO_CAMPANHA } from "@/components/campanhas/rotulos";
import { Escalonado, ItemEscalonado } from "@/components/motion/entrada";
import { listarCampanhas } from "@/db/campanhas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";
import { haQuantoTempo, taxa } from "@/services/crm";

export const metadata = { title: "Campanhas" };

const ABAS_CAMPANHAS = [
  { chave: "campanhas", rotulo: "Campanhas", href: "/campanhas" },
  { chave: "emails", rotulo: "E-mails enviados", href: "/emails" },
];

export default async function PaginaCampanhas() {
  const campanhas = await listarCampanhas();
  const novo = (
    <Link href="/campanhas/nova" className="inline-flex h-10 items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
      <Plus className="size-4" /> Nova campanha
    </Link>
  );

  return (
    <div>
      <Cabecalho icone={Megaphone} titulo="Campanhas" descricao="E-mails em massa: a IA escreve um para cada empresa, você revisa e autoriza, e eles saem aos poucos, com follow-up." acoes={novo} />
      <AbasPagina abas={ABAS_CAMPANHAS} ativa="campanhas" />
      {campanhas.length === 0 ? (
        <div className="placa">
          <Vazio icone={Megaphone} titulo="Nenhuma campanha ainda" descricao="Selecione leads na busca ou na lista e clique em “Criar campanha” — ou monte por filtro." acao={novo} />
        </div>
      ) : (
        <Escalonado className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((c) => {
            const progresso = c.total_leads > 0 ? Math.round((c.enviados / c.total_leads) * 100) : 0;
            return (
              <ItemEscalonado key={c.id}>
                <Link href={`/campanhas/${c.id}`} className="placa block p-5 transition-colors hover:border-brilho/40">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display font-semibold leading-snug">{c.nome}</p>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", COR_CAMPANHA[c.status])}>{ROTULO_CAMPANHA[c.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.total_leads} leads · {c.provedor_email ?? "—"} · criada {haQuantoTempo(c.criado_em)}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-azul to-ciano" style={{ width: `${progresso}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["Enviados", c.enviados],
                      ["Abertos", c.abertos],
                      ["Respostas", c.respostas],
                      ["Falhas", c.falhas],
                    ].map(([r, v]) => (
                      <div key={r as string}>
                        <dd className="font-display text-lg font-semibold num">{v as number}</dd>
                        <dt className="text-[0.68rem] text-muted-foreground">{r as string}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Resposta: {taxa(c.respostas, c.enviados)?.toLocaleString("pt-BR") ?? "—"}%{c.vendas_centavos > 0 ? ` · Vendas: ${formatarDinheiro(c.vendas_centavos)}` : ""}
                  </p>
                </Link>
              </ItemEscalonado>
            );
          })}
        </Escalonado>
      )}
    </div>
  );
}
