import { Megaphone } from "lucide-react";
import { notFound } from "next/navigation";

import { Cabecalho, Cartao } from "@/components/base/cartao";
import { AtualizacaoAutomatica, ControleCampanha, PreviewsEnvios } from "@/components/campanhas/controle-campanha";
import { COR_CAMPANHA, ROTULO_CAMPANHA, ROTULO_ENVIO } from "@/components/campanhas/rotulos";
import { Contador } from "@/components/motion/contador";
import { contagemPorStatus, enviosDaCampanha, obterCampanha } from "@/db/campanhas";
import { lerIdentidade } from "@/db/painel";
import type { StatusEnvio } from "@/db/tipos";
import { dataHora } from "@/lib/datas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";
import { taxa } from "@/services/crm";

export const metadata = { title: "Campanha" };

export default async function PaginaCampanha({ params }: PageProps<"/campanhas/[id]">) {
  const { id } = await params;
  const [c, envios, porStatus, identidade] = await Promise.all([obterCampanha(id), enviosDaCampanha(id), contagemPorStatus(id), lerIdentidade()]);
  if (!c) notFound();
  const fuso = identidade.config.fuso || "America/Manaus";
  const principais = envios.filter((e) => e.passo === 0);
  const followups = envios.filter((e) => e.passo > 0);
  const erros = porStatus.erro ?? 0;
  const emAndamento = ["preparando", "enviando", "agendada"].includes(c.status);

  return (
    <div className="space-y-5">
      <AtualizacaoAutomatica ativo={emAndamento} />
      <Cabecalho
        icone={Megaphone}
        titulo={c.nome}
        trilha={[{ href: "/campanhas", rotulo: "Campanhas" }]}
        descricao={
          <>
            <span className={cn("mr-2 inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", COR_CAMPANHA[c.status])}>{ROTULO_CAMPANHA[c.status]}</span>
            {c.provedor_email} · {c.ritmo_por_hora}/hora, até {c.limite_diario}/dia
            {c.followup_ativo ? ` · follow-ups nos dias ${(JSON.parse(c.followup_dias ?? "[]") as number[]).join(", ")}` : ""}
            {c.agendada_para && c.status === "agendada" ? ` · começa em ${dataHora(c.agendada_para, fuso)}` : ""}
          </>
        }
      />

      <ControleCampanha id={c.id} status={c.status} preparados={c.preparados} total={c.total_leads} erros={erros} />

      {c.status === "pronta" && (
        <div className="rounded-xl border border-aviso/30 bg-aviso/[0.07] p-4 text-sm">
          <p className="font-semibold text-aviso">Revise antes de enviar</p>
          <p className="text-muted-foreground">Nada sai sem a sua autorização. Abra os previews abaixo, edite o que quiser e então clique em “Autorizar e enviar agora” ou agende.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Leads", c.total_leads, null],
          ["Enviados", c.enviados, null],
          ["Abertos", c.abertos, taxa(c.abertos, c.enviados)],
          ["Cliques", c.cliques, taxa(c.cliques, c.enviados)],
          ["Respostas", c.respostas, taxa(c.respostas, c.enviados)],
          ["Falhas", c.falhas, null],
        ].map(([r, v, t]) => (
          <div key={r as string} className="placa p-4">
            <p className="text-xs text-muted-foreground">{r as string}</p>
            <Contador valor={v as number} className="font-display text-2xl font-semibold" />
            {t !== null && <p className="text-xs text-muted-foreground">{(t as number).toLocaleString("pt-BR")}%</p>}
          </div>
        ))}
      </div>
      {c.vendas_centavos > 0 && <p className="text-sm text-sucesso">Vendas vindas desta campanha: {formatarDinheiro(c.vendas_centavos)}</p>}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Cartao titulo="Primeira abordagem" subtitulo={`${principais.length} e-mail(s) — os três primeiros já abertos para revisão`}>
            <PreviewsEnvios campanhaId={c.id} envios={principais} editavel />
          </Cartao>
          {followups.length > 0 && (
            <Cartao titulo="Follow-ups" subtitulo="Saem só para quem não respondeu, nos dias configurados">
              <PreviewsEnvios campanhaId={c.id} envios={followups} editavel />
            </Cartao>
          )}
        </div>
        <div className="min-w-0 xl:col-span-4">
          <Cartao titulo="Fila" subtitulo="Estado de cada envio">
            <ul className="space-y-2 text-sm">
              {Object.entries(porStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([s, n]) => (
                  <li key={s} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{ROTULO_ENVIO[s as StatusEnvio] ?? s}</span>
                    <span className="font-semibold num">{n}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Criada em {dataHora(c.criado_em, fuso)}
              {c.autorizada_em ? ` · autorizada em ${dataHora(c.autorizada_em, fuso)}` : " · ainda não autorizada"}
              {c.concluida_em ? ` · concluída em ${dataHora(c.concluida_em, fuso)}` : ""}
            </p>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
