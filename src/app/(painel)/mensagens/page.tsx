import { Sparkles } from "lucide-react";
import Link from "next/link";

import { AvisoConfiguracao, Cabecalho, Vazio } from "@/components/base/cartao";
import { BotaoAnalisarLote } from "@/components/leads/botao-lote";
import { getBanco, planos } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";
import { obterIA } from "@/integrations/ai";
import { dataHora } from "@/lib/datas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mensagens IA" };

const TIPOS: Record<string, string> = {
  whatsapp: "WhatsApp",
  curta: "Curta",
  profissional: "Profissional",
  informal: "Informal",
  instagram: "Instagram DM",
  email: "E-mail",
  followup: "Follow-up",
};

type Mensagem = { id: string; lead_id: string; tipo: string; assunto: string | null; corpo: string; idioma: string | null; criado_em: string; nome: string; cidade: string | null };

/**
 * Tudo o que a IA escreveu, por lead e por versão. Para editar, copiar
 * ou abrir o WhatsApp, o lugar é o perfil do lead (o estúdio de
 * abordagem); aqui é a visão geral e o atalho para gerar em lote.
 */
export default async function PaginaMensagens({ searchParams }: PageProps<"/mensagens">) {
  const { tipo } = await searchParams;
  const filtroTipo = typeof tipo === "string" && tipo in TIPOS ? tipo : null;
  const banco = getBanco();
  const [{ rows }, { rows: sem }, iaOk, identidade] = await Promise.all([
    banco.execute({
      sql: `SELECT m.id, m.lead_id, m.tipo, m.assunto, m.corpo, m.idioma, m.criado_em, e.nome, e.cidade
            FROM mensagens m JOIN leads l ON l.id = m.lead_id JOIN empresas e ON e.id = l.empresa_id
            ${filtroTipo ? "WHERE m.tipo = ?" : ""}
            ORDER BY m.criado_em DESC LIMIT 120`,
      args: filtroTipo ? [filtroTipo] : [],
    }),
    banco.execute(`SELECT l.id FROM leads l JOIN empresas e ON e.id = l.empresa_id
                   WHERE l.prioridade = 'alta' AND l.etapa IN ('novo','qualificado') AND e.nao_contatar = 0
                     AND NOT EXISTS (SELECT 1 FROM mensagens m WHERE m.lead_id = l.id)
                   ORDER BY l.score_oportunidade DESC LIMIT 50`),
    obterIA().disponivel(),
    lerIdentidade(),
  ]);
  const mensagens = planos<Mensagem>(rows);
  const semMensagem = sem.map((r) => String(r.id));
  const fuso = identidade.config.fuso || "America/Manaus";

  return (
    <div className="space-y-5">
      <Cabecalho
        icone={Sparkles}
        titulo="Mensagens IA"
        descricao="Cada abordagem é escrita para uma empresa, só com o que foi encontrado sobre ela. Números inventados são barrados antes de chegar aqui."
        acoes={iaOk && semMensagem.length > 0 ? <BotaoAnalisarLote ids={semMensagem} gerarMensagens rotulo={`Gerar para ${semMensagem.length} de alta prioridade`} /> : undefined}
      />
      {!iaOk && <AvisoConfiguracao titulo="IA não configurada">Cole uma chave gratuita do Gemini em Configurações → Integrações para gerar análises e mensagens.</AvisoConfiguracao>}

      <nav className="flex flex-wrap gap-1.5" aria-label="Tipo">
        <Link href="/mensagens" className={cn("h-8 rounded-lg px-3 text-sm leading-8", !filtroTipo ? "bg-azul/20 text-ciano" : "text-muted-foreground hover:bg-white/5")}>
          Todas
        </Link>
        {Object.entries(TIPOS).map(([k, r]) => (
          <Link key={k} href={`/mensagens?tipo=${k}`} className={cn("h-8 rounded-lg px-3 text-sm leading-8", filtroTipo === k ? "bg-azul/20 text-ciano" : "text-muted-foreground hover:bg-white/5")}>
            {r}
          </Link>
        ))}
      </nav>

      {mensagens.length === 0 ? (
        <div className="placa">
          <Vazio icone={Sparkles} titulo="Nenhuma mensagem gerada ainda" descricao="Abra um lead e clique em “Gerar abordagem”, ou gere em lote para os leads de alta prioridade." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mensagens.map((m) => (
            <Link key={m.id} href={`/leads/${m.lead_id}`} className="placa flex flex-col p-4 transition-colors hover:border-brilho/40">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{m.nome}</p>
                <span className="shrink-0 rounded-full border border-brilho/30 bg-azul/10 px-2 py-0.5 text-[0.68rem] font-semibold text-[#b9caff]">{TIPOS[m.tipo] ?? m.tipo}</span>
              </div>
              {m.assunto && <p className="mt-2 text-xs font-semibold text-foreground/90">{m.assunto}</p>}
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">{m.corpo}</p>
              <p className="mt-auto pt-3 text-[0.7rem] text-muted-foreground/70">
                {dataHora(m.criado_em, fuso)}
                {m.idioma ? ` · ${m.idioma}` : ""}
                {m.cidade ? ` · ${m.cidade}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
