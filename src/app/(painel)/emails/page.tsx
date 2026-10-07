import { Mail } from "lucide-react";
import Link from "next/link";

import { AvisoConfiguracao, Cabecalho, Vazio } from "@/components/base/cartao";
import { COR_ENVIO, ROTULO_ENVIO } from "@/components/campanhas/rotulos";
import { Contador } from "@/components/motion/contador";
import { getBanco, planos } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";
import type { StatusEnvio } from "@/db/tipos";
import { estadoProvedoresEmail } from "@/integrations/email";
import { dataHora } from "@/lib/datas";
import { cn } from "@/lib/utils";

export const metadata = { title: "E-mails" };

type Envio = { id: string; lead_id: string; campanha_id: string | null; campanha: string | null; passo: number; destinatario: string | null; assunto: string | null; status: StatusEnvio; provedor: string | null; erro: string | null; enviado_em: string | null; agendado_para: string | null; aberto_em: string | null; nome: string };

/** A caixa de saída: todos os envios, de campanha ou avulsos, com o estado. */
export default async function PaginaEmails({ searchParams }: PageProps<"/emails">) {
  const { status } = await searchParams;
  const filtro = typeof status === "string" && status in ROTULO_ENVIO ? status : null;
  const banco = getBanco();
  const [{ rows }, { rows: cont }, provedores, identidade] = await Promise.all([
    banco.execute({
      sql: `SELECT en.id, en.lead_id, en.campanha_id, c.nome campanha, en.passo, en.destinatario, en.assunto, en.status, en.provedor, en.erro,
                   en.enviado_em, en.agendado_para, en.aberto_em, e.nome
            FROM envios en JOIN leads l ON l.id = en.lead_id JOIN empresas e ON e.id = l.empresa_id LEFT JOIN campanhas c ON c.id = en.campanha_id
            ${filtro ? "WHERE en.status = ?" : "WHERE en.status NOT IN ('pendente')"}
            ORDER BY COALESCE(en.enviado_em, en.agendado_para, en.atualizado_em) DESC LIMIT 200`,
      args: filtro ? [filtro] : [],
    }),
    banco.execute(`SELECT
        SUM(enviado_em IS NOT NULL) enviados,
        SUM(status IN ('entregue','aberto','clicado','respondeu')) entregues,
        SUM(aberto_em IS NOT NULL) abertos,
        SUM(clicado_em IS NOT NULL) clicados,
        SUM(respondido_em IS NOT NULL) respostas,
        SUM(status = 'agendado') agendados,
        SUM(status = 'erro') erros
      FROM envios`),
    estadoProvedoresEmail(),
    lerIdentidade(),
  ]);
  const envios = planos<Envio>(rows);
  const c = cont[0] ?? {};
  const fuso = identidade.config.fuso || "America/Manaus";
  const ativo = identidade.config.email_provedor || "gmail";
  const provAtivo = provedores.find((p) => p.nome === ativo);

  return (
    <div className="space-y-5">
      <Cabecalho icone={Mail} titulo="E-mails" descricao={`Tudo o que saiu, está agendado ou falhou. Provedor ativo: ${provAtivo?.rotulo ?? ativo}.`} />
      {provAtivo && !provAtivo.ok && (
        <AvisoConfiguracao titulo={`${provAtivo.rotulo} não está pronto`} href="/configuracoes?aba=email">
          {provAtivo.motivo} Sem um provedor pronto, campanhas podem ser preparadas mas não enviadas.
        </AvisoConfiguracao>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Enviados", c.enviados, null],
          ["Entregues", c.entregues, null],
          ["Abertos", c.abertos, null],
          ["Clicados", c.clicados, null],
          ["Respostas", c.respostas, null],
          ["Agendados", c.agendados, "agendado"],
          ["Com erro", c.erros, "erro"],
        ].map(([r, v, s]) => (
          <Link key={r as string} href={s ? `/emails?status=${s}` : "/emails"} className="placa p-4 transition-colors hover:border-brilho/40">
            <p className="text-xs text-muted-foreground">{r as string}</p>
            <Contador valor={Number(v ?? 0)} className="font-display text-2xl font-semibold" />
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Abertura é medida por pixel e pode ser bloqueada pelo leitor de e-mail; “entregue” só existe com o webhook do Resend. Os números são o que foi registrado, sem estimativa.</p>

      {envios.length === 0 ? (
        <div className="placa">
          <Vazio icone={Mail} titulo="Nenhum e-mail ainda" descricao="E-mails de campanhas e os enviados do perfil do lead aparecem aqui." />
        </div>
      ) : (
        <ul className="placa divide-y divide-fio">
          {envios.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/leads/${e.lead_id}`} className="block truncate font-semibold hover:text-ciano">
                  {e.nome}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {e.assunto ?? "(sem assunto)"} · {e.destinatario ?? "—"}
                  {e.campanha ? ` · campanha "${e.campanha}"` : " · avulso"}
                  {e.passo > 0 ? ` · follow-up ${e.passo}` : ""}
                </p>
                {e.erro && <p className="truncate text-xs text-perigo/90">{e.erro}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{dataHora(e.enviado_em ?? e.agendado_para, fuso)}</span>
              <span className={cn("w-20 text-right text-xs font-semibold", COR_ENVIO[e.status])}>{ROTULO_ENVIO[e.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
