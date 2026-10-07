import { Flame } from "lucide-react";
import Link from "next/link";

import { Cabecalho } from "@/components/base/cartao";
import { BotaoAnalisarLote } from "@/components/leads/botao-lote";
import { SeloPresenca } from "@/components/leads/presenca";
import { AnelScore } from "@/components/leads/score";
import { Escalonado, ItemEscalonado } from "@/components/motion/entrada";
import { getBanco, planos } from "@/db/cliente";
import type { QualidadeSite, StatusSite } from "@/db/tipos";
import { FRASE_SOLUCAO, type Solucao } from "@/integrations/ai/agentes/sales-opportunity-analyzer";
import { cn } from "@/lib/utils";

export const metadata = { title: "Oportunidades" };

type Linha = {
  lead_id: string;
  nome: string;
  categoria: string;
  cidade: string | null;
  score: number | null;
  prioridade: string;
  solucao_sugerida: string | null;
  analisado_em: string | null;
  status_site: StatusSite;
  site_qualidade: QualidadeSite | null;
  avaliacao_qtd: number | null;
  avaliacao_nota: number | null;
  produto: string | null;
};

const GRUPOS = [
  { chave: "alta", titulo: "Alta prioridade", cor: "bg-[#ff8a5c]", descricao: "Abordar primeiro: canal disponível e presença digital fraca." },
  { chave: "media", titulo: "Média prioridade", cor: "bg-aviso", descricao: "Vale abordar depois das de alta." },
  { chave: "baixa", titulo: "Baixa prioridade", cor: "bg-muted-foreground", descricao: "Sem canal de contato, ou site já bom." },
] as const;

/**
 * Inteligência comercial: quem abordar, por quê e com o quê. Só leads
 * ainda não abordados e que podem ser contatados.
 */
export default async function PaginaOportunidades() {
  const banco = getBanco();
  const [{ rows }, { rows: contagem }] = await Promise.all([
    banco.execute(`
      SELECT * FROM (
        SELECT l.id lead_id, e.nome, COALESCE(e.categoria_rotulo, e.categoria) categoria, e.cidade, l.score_oportunidade score,
               COALESCE(l.prioridade, 'baixa') prioridade, l.solucao_sugerida, l.analisado_em, e.status_site, e.site_qualidade,
               e.avaliacao_qtd, e.avaliacao_nota, p.nome produto,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(l.prioridade, 'baixa') ORDER BY l.score_oportunidade DESC, e.avaliacao_qtd DESC) n
        FROM leads l JOIN empresas e ON e.id = l.empresa_id LEFT JOIN produtos p ON p.id = l.produto_sugerido_id
        WHERE l.etapa IN ('novo','qualificado') AND e.nao_contatar = 0
      ) WHERE n <= 30`),
    banco.execute(`
      SELECT COALESCE(l.prioridade,'baixa') p, COUNT(*) n, SUM(l.analisado_em IS NULL) sem
      FROM leads l JOIN empresas e ON e.id = l.empresa_id
      WHERE l.etapa IN ('novo','qualificado') AND e.nao_contatar = 0 GROUP BY p`),
  ]);
  const linhas = planos<Linha>(rows);
  const totais = new Map(contagem.map((r) => [String(r.p), { n: Number(r.n), sem: Number(r.sem) }]));
  const semAnaliseAlta = linhas.filter((l) => l.prioridade === "alta" && !l.analisado_em).map((l) => l.lead_id);

  return (
    <div>
      <Cabecalho
        icone={Flame}
        titulo="Oportunidades"
        descricao="Quem abordar, por quê e o que oferecer. Leads ainda não abordados, por prioridade."
        acoes={semAnaliseAlta.length > 0 ? <BotaoAnalisarLote ids={semAnaliseAlta} rotulo={`Analisar ${semAnaliseAlta.length} de alta prioridade`} /> : undefined}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        {GRUPOS.map((g) => {
          const itens = linhas.filter((l) => l.prioridade === g.chave);
          const t = totais.get(g.chave);
          return (
            <section key={g.chave} className="placa flex flex-col">
              <header className="border-b border-fio px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", g.cor)} aria-hidden="true" />
                  <h2 className="font-display font-semibold">{g.titulo}</h2>
                  <span className="ml-auto text-sm text-muted-foreground num">{(t?.n ?? 0).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.descricao}</p>
              </header>
              {itens.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum lead aqui agora.</p>
              ) : (
                <Escalonado className="space-y-1 p-2">
                  {itens.map((l) => (
                    <ItemEscalonado key={l.lead_id}>
                      <Link href={`/leads/${l.lead_id}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                        <div className="flex items-center gap-3">
                          <AnelScore score={l.score} tamanho={38} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{l.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {l.categoria}
                              {l.cidade ? ` · ${l.cidade}` : ""}
                              {l.avaliacao_qtd ? ` · ${l.avaliacao_nota?.toFixed(1).replace(".", ",")}★ ${l.avaliacao_qtd}` : ""}
                            </p>
                          </div>
                          <SeloPresenca statusSite={l.status_site} qualidade={l.site_qualidade} className="hidden sm:inline-flex" />
                        </div>
                        <p className="mt-1.5 pl-[3.1rem] text-xs text-ciano/90">
                          {l.solucao_sugerida ? `${FRASE_SOLUCAO[l.solucao_sugerida as Solucao]}${l.produto ? ` Produto: ${l.produto}.` : ""}` : "Ainda sem análise da IA."}
                        </p>
                      </Link>
                    </ItemEscalonado>
                  ))}
                </Escalonado>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
