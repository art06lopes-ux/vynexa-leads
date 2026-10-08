import { Brain, Building2, ExternalLink, Gauge, Globe, History, Mail, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Cartao } from "@/components/base/cartao";
import { Avatar, IconeInstagram } from "@/components/leads/cartao-lead";
import { SeloPresenca, SeloPrioridade } from "@/components/leads/presenca";
import { AnelScore, BarraMotivo } from "@/components/leads/score";
import { Entrada } from "@/components/motion/entrada";
import { AcoesLead, EditarContatos, SeletorEtapa } from "@/components/perfil/controles";
import { EstudioAbordagem } from "@/components/perfil/estudio-abordagem";
import { PainelNegocio } from "@/components/perfil/negocio";
import { getBanco } from "@/db/cliente";
import { detalhesDoLead, obterLead } from "@/db/leads";
import { lerIdentidade } from "@/db/painel";
import { ROTULO_FONTE } from "@/db/tipos";
import { obterIA } from "@/integrations/ai";
import type { AnaliseCompleta } from "@/services/inteligencia";
import { ROTULO_SOLUCAO, FRASE_SOLUCAO, type Solucao } from "@/integrations/ai/agentes/sales-opportunity-analyzer";
import { provedorEmailAtivo } from "@/integrations/email";
import { nomePaisPt } from "@/lib/geo/mundo";
import { linkInstagram } from "@/lib/leads/redes";
import { formatarTelefone, normalizarTelefone } from "@/lib/leads/whatsapp";
import { dataHora } from "@/lib/datas";
import { diagnosticoPorRegra } from "@/services/diagnostico";
import { ROTULO_EVENTO } from "@/services/eventos";
import { assinaturaTexto } from "@/services/composicao-email";
import type { Avaliacao } from "@/services/qualidade-site";
import { carregarIdentidade } from "@/services/envio";

export const metadata = { title: "Lead" };

function Linha({ icone: Icone, rotulo, children }: { icone: typeof Phone; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] text-muted-foreground">{rotulo}</p>
        <div className="truncate text-sm">{children}</div>
      </div>
    </div>
  );
}

function NaoEncontrado() {
  return <span className="text-muted-foreground/70">Não encontrado</span>;
}

export default async function PaginaLead({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const dados = await obterLead(id);
  if (!dados) notFound();
  const { empresa: e, lead, motivos } = dados;

  const banco = getBanco();
  const [det, identidade, iaOk, provedor, prods, ident] = await Promise.all([
    detalhesDoLead(id),
    lerIdentidade(),
    obterIA().disponivel(),
    provedorEmailAtivo().then((p) => p.pronto()),
    banco.execute(`SELECT id, nome, preco_centavos, moeda FROM produtos WHERE ativo = 1 ORDER BY ordem, nome`),
    carregarIdentidade(banco),
  ]);
  const fuso = identidade.config.fuso || "America/Manaus";
  const produtos = prods.rows.map((r) => ({ id: String(r.id), nome: String(r.nome), preco_centavos: Number(r.preco_centavos), moeda: String(r.moeda) }));

  let analise: AnaliseCompleta | null = null;
  try {
    analise = lead.analise ? (JSON.parse(lead.analise) as AnaliseCompleta) : null;
  } catch {
    analise = null;
  }
  let site: (Avaliacao & { sinais?: { tempoMs?: number | null } }) | null = null;
  try {
    site = e.site_sinais ? JSON.parse(e.site_sinais) : null;
  } catch {
    site = null;
  }

  const numeroWhats = e.whatsapp === 1 ? normalizarTelefone(e.telefone, e.pais) : null;
  const instagram = linkInstagram(e.instagram);
  const local = [e.bairro, e.cidade, e.estado, nomePaisPt(e.pais)].filter(Boolean).join(", ");
  const nota = e.avaliacao_nota !== null ? e.avaliacao_nota.toFixed(1).replace(".", ",") : null;
  const produtoSugerido = produtos.find((p) => p.id === lead.produto_sugerido_id);

  const botaoLink = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm transition-colors hover:border-brilho/40";

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Trilha">
        <Link href="/leads" className="hover:text-foreground">
          Leads
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{e.nome}</span>
      </nav>

      {/* Cabeçalho */}
      <Entrada className="heroi p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Avatar nome={e.nome} tamanho={60} />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{e.nome}</h1>
              <p className="mt-1 text-sm text-white/70">{e.categoria_rotulo ?? e.categoria}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/75">
                {nota && (
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-aviso text-aviso" /> <b className="text-white">{nota}</b> · {e.avaliacao_qtd?.toLocaleString("pt-BR")} avaliações
                  </span>
                )}
                {local && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> {local}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SeloPresenca statusSite={e.status_site} qualidade={e.site_qualidade} />
                <SeloPrioridade prioridade={lead.prioridade} />
                {e.nao_contatar === 1 && <span className="rounded-full border border-perigo/40 bg-perigo/15 px-2 py-0.5 text-[0.7rem] font-bold text-perigo">NÃO CONTATAR</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/60">Score de oportunidade</p>
              <p className="font-display text-3xl font-semibold text-white num">
                {lead.score_oportunidade ?? "–"}
                <span className="text-base text-white/50">/100</span>
              </p>
            </div>
            <AnelScore score={lead.score_oportunidade} tamanho={76} espessura={7} rotulo={false} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {/* Um caminho só para o WhatsApp: a caixa "Abordagem", que escreve a
              mensagem e registra o contato. Este botão leva até ela. */}
          {numeroWhats && (
            <a href="#abordagem" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1fa855] px-3 text-sm font-semibold text-white hover:bg-[#25c062]">
              <MessageCircle className="size-4" /> Mandar WhatsApp
            </a>
          )}
          {e.email && (
            <a href={`mailto:${e.email}`} className={botaoLink}>
              <Mail className="size-4" /> E-mail
            </a>
          )}
          {e.fonte_url && (
            <a href={e.fonte_url} target="_blank" rel="noopener noreferrer" className={botaoLink}>
              <MapPin className="size-4" /> {e.fonte === "google_places" ? "Google Maps" : ROTULO_FONTE[e.fonte]}
            </a>
          )}
          {e.website && (
            <a href={/^https?:/.test(e.website) ? e.website : `https://${e.website}`} target="_blank" rel="noopener noreferrer" className={botaoLink}>
              <Globe className="size-4" /> {e.status_site === "rede_social" ? "Rede social" : "Site"}
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className={botaoLink}>
              <IconeInstagram className="size-4" /> Instagram
            </a>
          )}
          <div className="ml-auto">
            <SeletorEtapa leadId={id} etapa={lead.etapa} />
          </div>
        </div>
      </Entrada>

      <AcoesLead leadId={id} naoContatar={e.nao_contatar === 1} iaConfigurada={iaOk} analisado={Boolean(lead.analisado_em)} />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          {/* Por que é interessante */}
          <Cartao icone={Gauge} titulo="Por que esse lead é interessante?" subtitulo="Cada ponto do score, com o motivo">
            {motivos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Score ainda não calculado pelas regras da v2.</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {motivos.map((m) => (
                  <li key={m.motivo} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{m.motivo}</span>
                      <span className={`font-semibold num ${m.pontos >= 0 ? "text-ciano" : "text-perigo"}`}>
                        {m.pontos >= 0 ? "+" : ""}
                        {m.pontos}
                      </span>
                    </div>
                    <BarraMotivo pontos={m.pontos} />
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {/* Diagnóstico e inteligência */}
          <Cartao icone={Brain} titulo="Diagnóstico" subtitulo={analise ? `Análise da IA · ${dataHora(lead.analisado_em, fuso)}` : "Escrito pelas regras, só com os dados encontrados"}>
            <p className="text-[0.95rem] leading-relaxed">{analise?.diagnostico ?? diagnosticoPorRegra(e)}</p>
            {analise && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-fio bg-white/[0.02] p-4">
                  <p className="rotulo">Resumo</p>
                  <p className="mt-1 text-sm">{analise.resumo}</p>
                  <p className="rotulo mt-3">Por que pode precisar</p>
                  <p className="mt-1 text-sm">{analise.porQuePrecisa}</p>
                </div>
                <div className="rounded-xl border border-fio bg-white/[0.02] p-4">
                  <p className="rotulo">Principais oportunidades</p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-sm marker:text-ciano">
                    {analise.oportunidades.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-brilho/30 bg-azul/[0.08] p-4 md:col-span-2">
                  <p className="text-sm font-semibold text-ciano">{FRASE_SOLUCAO[analise.oportunidade.solucao as Solucao]}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="rotulo">Melhor serviço</p>
                      <p className="mt-0.5 text-sm font-semibold">{produtoSugerido?.nome ?? ROTULO_SOLUCAO[analise.oportunidade.solucao as Solucao]}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="rotulo">Argumento de venda</p>
                      <p className="mt-0.5 text-sm">{analise.oportunidade.argumento}</p>
                    </div>
                  </div>
                  <p className="rotulo mt-3">CTA</p>
                  <p className="mt-0.5 text-sm">{analise.oportunidade.cta}</p>
                </div>
              </div>
            )}
          </Cartao>

          <div id="abordagem" className="scroll-mt-24">
            <EstudioAbordagem
              leadId={id}
              mensagens={det.mensagens}
              whatsappNumero={numeroWhats}
              email={e.email}
              instagramUrl={instagram}
              naoContatar={e.nao_contatar === 1}
              remetente={identidade.responsavel}
              assinatura={assinaturaTexto(ident.identidade)}
              provedorEmailPronto={provedor.ok}
              iaConfigurada={iaOk}
            />
          </div>

          {det.envios.length > 0 && (
            <Cartao icone={Mail} titulo="E-mails" subtitulo="Envios para este lead">
              <ul className="divide-y divide-fio">
                {det.envios.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{v.assunto ?? "(sem assunto)"}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.campanha_nome ? `Campanha "${v.campanha_nome}"` : "Envio avulso"}
                        {v.passo > 0 ? ` · follow-up ${v.passo}` : ""}
                        {v.erro ? ` · ${v.erro}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <b className="text-foreground">{v.status}</b> · {dataHora(v.enviado_em ?? v.agendado_para, fuso)}
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Cartao icone={Building2} titulo="Dados da empresa" subtitulo={`Fonte: ${ROTULO_FONTE[e.fonte]}`} corpoClassName="pt-1">
            <div className="divide-y divide-fio">
              <Linha icone={Phone} rotulo={e.whatsapp === 1 ? "Telefone · WhatsApp" : "Telefone"}>
                {e.telefone ? <span className="font-mono text-[0.85rem]">{formatarTelefone(e.telefone, e.pais)}</span> : <NaoEncontrado />}
              </Linha>
              <Linha icone={Mail} rotulo="E-mail">
                {e.email ?? <NaoEncontrado />}
              </Linha>
              <Linha icone={Globe} rotulo="Site">
                {e.website ? (
                  <a href={/^https?:/.test(e.website) ? e.website : `https://${e.website}`} target="_blank" rel="noopener noreferrer" className="text-ciano hover:underline">
                    {e.website}
                  </a>
                ) : (
                  <NaoEncontrado />
                )}
              </Linha>
              <Linha icone={IconeInstagram as unknown as typeof Phone} rotulo="Instagram">
                {instagram ? (
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-ciano hover:underline">
                    {e.instagram}
                  </a>
                ) : (
                  <NaoEncontrado />
                )}
              </Linha>
              <Linha icone={MapPin} rotulo="Endereço">
                <span className="whitespace-normal">{e.endereco ?? <NaoEncontrado />}</span>
              </Linha>
              {e.fonte_url && (
                <Linha icone={ExternalLink} rotulo="Registro na fonte">
                  <a href={e.fonte_url} target="_blank" rel="noopener noreferrer" className="text-ciano hover:underline">
                    Abrir no {ROTULO_FONTE[e.fonte]}
                  </a>
                </Linha>
              )}
            </div>
            <div className="mt-2">
              <EditarContatos leadId={id} inicial={{ telefone: e.telefone, email: e.email, instagram: e.instagram, website: e.website }} />
            </div>
          </Cartao>

          {e.status_site === "tem_site" && (
            <Cartao icone={Globe} titulo="Avaliação do site" subtitulo={e.site_avaliado_em ? `Visitado em ${dataHora(e.site_avaliado_em, fuso)}` : "Na fila para visita automática"}>
              {site ? (
                <div className="space-y-3 text-sm">
                  <p>
                    Nota técnica: <b className="num">{site.pontos}/100</b>
                  </p>
                  {site.problemas.length > 0 && (
                    <ul className="space-y-1">
                      {site.problemas.map((p) => (
                        <li key={p} className="flex gap-2 text-[#ffb48a]">
                          <span aria-hidden="true">✕</span> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {site.positivos.length > 0 && (
                    <ul className="space-y-1">
                      {site.positivos.map((p) => (
                        <li key={p} className="flex gap-2 text-sucesso">
                          <span aria-hidden="true">✓</span> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">O worker visita a página inicial (respeitando o robots.txt) e mede HTTPS, celular, velocidade e sinais de abandono.</p>
              )}
            </Cartao>
          )}

          <PainelNegocio
            leadId={id}
            propostas={det.propostas}
            vendas={det.vendas}
            produtos={produtos}
            produtoSugerido={lead.produto_sugerido_id}
            iaConfigurada={iaOk}
            empresa={e.nome}
          />

          <Cartao icone={History} titulo="Histórico" subtitulo={det.campanhas.length > 0 ? `Em ${det.campanhas.length} campanha(s)` : undefined}>
            <ol className="relative space-y-4 border-l border-fio pl-5">
              {det.eventos.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 size-2.5 rounded-full border-2 border-background bg-ciano" aria-hidden="true" />
                  <p className="text-xs text-muted-foreground">{dataHora(ev.criado_em, fuso)}</p>
                  <p className="text-sm font-medium">{ROTULO_EVENTO[ev.tipo as keyof typeof ROTULO_EVENTO] ?? ev.tipo}</p>
                  {ev.descricao !== (ROTULO_EVENTO[ev.tipo as keyof typeof ROTULO_EVENTO] ?? "") && <p className="text-xs text-muted-foreground">{ev.descricao}</p>}
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
