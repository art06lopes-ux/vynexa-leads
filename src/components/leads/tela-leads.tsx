"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Ellipsis, FileUp, LoaderCircle, Mail, MessageCircle, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BarraMassa, SeletorQuantidade, useSelecao } from "@/components/leads/barra-massa";
import { Avatar, CartaoLead } from "@/components/leads/cartao-lead";
import { SeloEtapa, SeloPresenca } from "@/components/leads/presenca";
import { AnelScore } from "@/components/leads/score";
import type { LeadListado, OpcaoFiltro } from "@/db/leads";
import { ROTULO_SITUACAO, SITUACOES } from "@/db/para-abordar";
import { nichoDe } from "@/lib/leads/nicho";
import { cn } from "@/lib/utils";
import { ETAPAS, ROTULO_ETAPA } from "@/services/crm";

/**
 * Lista de leads: filtros na URL (dá para salvar e compartilhar o link),
 * tabela no desktop e cartões no celular, seleção em massa e exportação.
 */

const campo = "h-9 rounded-lg border border-fio bg-placa px-2.5 text-sm outline-none focus:border-brilho/60";

export function TelaLeads({
  itens,
  total,
  pagina,
  porPagina,
  opcoes,
}: {
  itens: LeadListado[];
  total: number;
  pagina: number;
  porPagina: number;
  opcoes: { paises: OpcaoFiltro[]; estados: OpcaoFiltro[]; cidades: string[]; nichos: string[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selecao = useSelecao();
  const [maisFiltros, setMaisFiltros] = useState(() => ["scoreMin", "etapa", "prioridade", "fonte"].some((k) => params.get(k)));
  const [menuMais, setMenuMais] = useState(false);
  const [modal, setModal] = useState<null | "csv" | "manual">(null);
  const [texto, setTexto] = useState(params.get("q") ?? "");

  const valor = (k: string) => params.get(k) ?? "";
  /** Muda um ou mais filtros de uma vez (país limpa estado e cidade, por exemplo). */
  function definir(mudancas: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("pagina");
    p.delete("aba");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }
  const consulta = (() => {
    const p = new URLSearchParams(params.toString());
    p.delete("pagina");
    return p.toString();
  })();
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const irPara = (n: number) => {
    const p = new URLSearchParams(params.toString());
    p.set("pagina", String(n));
    router.push(`${pathname}?${p.toString()}`);
  };
  const contato = valor("whatsapp") && valor("email") ? "ambos" : valor("whatsapp") ? "whatsapp" : valor("email") ? "email" : "";
  const filtrosUsados = ["q", "pais", "estado", "cidade", "categoria", "situacao", "whatsapp", "email", "site", "scoreMin", "etapa", "prioridade", "fonte"].filter((k) => params.get(k)).length;
  const limparFiltros = () => {
    setTexto("");
    router.push(params.get("busca") ? `${pathname}?busca=${params.get("busca")}` : pathname);
  };

  const rotuloCampo = "mb-1 block text-[0.72rem] font-medium text-muted-foreground";
  const seletor = (ligado: boolean) => cn(campo, "w-full cursor-pointer", ligado && "border-brilho/60 bg-azul/10 text-foreground");

  return (
    <div className="space-y-4">
      {/* Filtros — sempre à vista */}
      <div className="placa p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              definir({ q: texto.trim() });
            }}
            className="col-span-2 sm:col-span-3 lg:col-span-1"
          >
            <label htmlFor="filtro-q" className={rotuloCampo}>
              Procurar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="filtro-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome ou telefone" className={cn(campo, "w-full pl-8")} />
            </div>
          </form>

          <label>
            <span className={rotuloCampo}>País</span>
            <select value={valor("pais")} onChange={(e) => definir({ pais: e.target.value, estado: "", cidade: "" })} className={seletor(Boolean(valor("pais")))}>
              <option value="">Todos os países</option>
              {opcoes.paises.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Estado</span>
            <select value={valor("estado").toUpperCase()} onChange={(e) => definir({ estado: e.target.value, cidade: "" })} className={seletor(Boolean(valor("estado")))}>
              <option value="">Todos os estados</option>
              {opcoes.estados.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Cidade</span>
            <select value={valor("cidade")} onChange={(e) => definir({ cidade: e.target.value })} className={seletor(Boolean(valor("cidade")))}>
              <option value="">Todas as cidades</option>
              {opcoes.cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Nicho</span>
            <select value={valor("categoria").toLowerCase()} onChange={(e) => definir({ categoria: e.target.value })} className={seletor(Boolean(valor("categoria")))}>
              <option value="">Todos os nichos</option>
              {opcoes.nichos.map((n) => (
                <option key={n} value={n}>
                  {n.charAt(0).toUpperCase() + n.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Situação</span>
            <select value={valor("situacao")} onChange={(e) => definir({ situacao: e.target.value })} className={seletor(Boolean(valor("situacao")))}>
              <option value="">Todas</option>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Contato</span>
            <select
              value={contato}
              onChange={(e) => {
                const v = e.target.value;
                definir({ whatsapp: v === "whatsapp" || v === "ambos" ? "1" : "", email: v === "email" || v === "ambos" ? "1" : "" });
              }}
              className={seletor(Boolean(contato))}
            >
              <option value="">Qualquer</option>
              <option value="whatsapp">Com WhatsApp</option>
              <option value="email">Com e-mail</option>
              <option value="ambos">Com WhatsApp e e-mail</option>
            </select>
          </label>

          <label>
            <span className={rotuloCampo}>Site</span>
            <select value={valor("site")} onChange={(e) => definir({ site: e.target.value })} className={seletor(Boolean(valor("site")))}>
              <option value="">Todos</option>
              <option value="sem">Sem site</option>
              <option value="social">Só redes sociais</option>
              <option value="ruim">Site fraco</option>
              <option value="com">Com site</option>
            </select>
          </label>
        </div>

        <AnimatePresence initial={false}>
          {maisFiltros && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-fio pt-3 sm:grid-cols-4">
                <label>
                  <span className={rotuloCampo}>Score mínimo</span>
                  <select value={valor("scoreMin")} onChange={(e) => definir({ scoreMin: e.target.value })} className={seletor(Boolean(valor("scoreMin")))}>
                    <option value="">Qualquer</option>
                    {[50, 60, 70, 80, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} ou mais
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={rotuloCampo}>Etapa do CRM</span>
                  <select value={valor("etapa")} onChange={(e) => definir({ etapa: e.target.value })} className={seletor(Boolean(valor("etapa")))}>
                    <option value="">Todas</option>
                    {ETAPAS.map((e) => (
                      <option key={e} value={e}>
                        {ROTULO_ETAPA[e]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={rotuloCampo}>Prioridade</span>
                  <select value={valor("prioridade")} onChange={(e) => definir({ prioridade: e.target.value })} className={seletor(Boolean(valor("prioridade")))}>
                    <option value="">Todas</option>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </label>
                <label>
                  <span className={rotuloCampo}>Fonte</span>
                  <select value={valor("fonte")} onChange={(e) => definir({ fonte: e.target.value })} className={seletor(Boolean(valor("fonte")))}>
                    <option value="">Todas</option>
                    <option value="google_places">Google Maps</option>
                    <option value="osm">OpenStreetMap</option>
                    <option value="receita">Receita Federal</option>
                    <option value="csv">Planilha</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <button type="button" onClick={() => setMaisFiltros((m) => !m)} aria-expanded={maisFiltros} className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
            <SlidersHorizontal className="size-3.5" /> {maisFiltros ? "Menos filtros" : "Mais filtros (score, etapa, prioridade, fonte)"}
          </button>
          {filtrosUsados > 0 && (
            <button type="button" onClick={limparFiltros} className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" /> Limpar filtros
            </button>
          )}
          {params.get("busca") && (
            <button type="button" onClick={() => definir({ busca: "" })} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-brilho/40 bg-azul/10 px-2 py-0.5 text-ciano hover:bg-azul/20">
              Só as empresas de uma busca <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Resultado: seleção, contagem, ordem e "Mais" */}
      <div className="flex flex-wrap items-center gap-2">
        <SeletorQuantidade consulta={consulta} total={total} aoSelecionar={selecao.definir} />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground num">{total.toLocaleString("pt-BR")}</span> empresa(s)
          {params.get("q") && (
            <>
              {" "}
              para &quot;<span className="text-foreground">{params.get("q")}</span>&quot;
            </>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <select value={valor("ordem")} onChange={(e) => definir({ ordem: e.target.value })} className={cn(campo, "cursor-pointer")} aria-label="Ordenar">
            <option value="">Melhor score</option>
            <option value="recentes">Mais recentes</option>
            <option value="avaliacoes">Mais avaliações</option>
            <option value="nome">Nome</option>
          </select>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuMais((m) => !m)}
              aria-expanded={menuMais}
              aria-haspopup="menu"
              className={cn(campo, "inline-flex cursor-pointer items-center gap-1.5 hover:border-brilho/40")}
            >
              <Ellipsis className="size-4" /> Mais
            </button>
            <AnimatePresence>
              {menuMais && (
                <>
                  <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuMais(false)} />
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-xl border border-fio bg-[#0b1433] py-1 shadow-2xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setModal("manual");
                        setMenuMais(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <Plus className="size-4" /> Adicionar empresa
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setModal("csv");
                        setMenuMais(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <FileUp className="size-4" /> Importar planilha CSV
                    </button>
                    <div className="my-1 border-t border-fio" />
                    {(["xlsx", "csv", "json"] as const).map((f) => (
                      <a key={f} role="menuitem" href={`/api/exportar?formato=${f}&${consulta}`} onClick={() => setMenuMais(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5">
                        <Download className="size-4" /> Exportar esta lista ({f === "xlsx" ? "Excel" : f.toUpperCase()})
                      </a>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="placa px-6 py-14 text-center">
          <p className="font-display text-base font-semibold">Nenhum lead encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Faça uma busca por categoria e localização para começar, ou ajuste os filtros.</p>
          <Link href="/buscar" className="mt-5 inline-flex h-10 items-center rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho">
            Buscar leads
          </Link>
        </div>
      ) : (
        <>
          {/* Tabela no desktop */}
          <div className="placa hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fio text-left text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar a página"
                      checked={itens.every((l) => selecao.tem(l.lead_id))}
                      onChange={(e) => selecao.definir(e.target.checked ? [...new Set([...selecao.ids, ...itens.map((l) => l.lead_id)])] : [...selecao.ids].filter((id) => !itens.some((l) => l.lead_id === id)))}
                      className="size-4 cursor-pointer accent-[#3366ff]"
                    />
                  </th>
                  <th className="py-3 font-medium">Empresa</th>
                  <th className="hidden py-3 font-medium xl:table-cell">Local</th>
                  <th className="py-3 font-medium">Contato</th>
                  <th className="hidden py-3 font-medium xl:table-cell">Avaliações</th>
                  <th className="py-3 font-medium">Presença</th>
                  <th className="py-3 font-medium">Etapa</th>
                  <th className="py-3 pr-4 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l, i) => (
                  <motion.tr
                    key={l.lead_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    className={cn("border-b border-fio/60 transition-colors last:border-0 hover:bg-white/[0.025]", selecao.tem(l.lead_id) && "bg-azul/[0.07]")}
                  >
                    <td className="px-4 py-2.5">
                      <input type="checkbox" aria-label={`Selecionar ${l.nome}`} checked={selecao.tem(l.lead_id)} onChange={() => selecao.alternar(l.lead_id)} className="size-4 cursor-pointer accent-[#3366ff]" />
                    </td>
                    <td className="max-w-72 py-2.5">
                      <Link href={`/leads/${l.lead_id}`} className="flex items-center gap-3">
                        <Avatar nome={l.nome} tamanho={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold hover:text-ciano">{l.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {nichoDe(l.categoria, l.cidade) || l.categoria_rotulo}
                            <span className="xl:hidden">{l.cidade ? ` · ${l.cidade}` : ""}</span>
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden max-w-44 truncate py-2.5 text-muted-foreground xl:table-cell">{[l.cidade, l.estado].filter(Boolean).join(", ") || l.pais}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span title={l.whatsapp === 1 ? "Tem WhatsApp" : "Sem WhatsApp"} className={cn("flex size-7 items-center justify-center rounded-lg", l.whatsapp === 1 ? "bg-[#1fa855]/15 text-[#3ddc84]" : "text-white/15")}>
                          <MessageCircle className="size-4" aria-label={l.whatsapp === 1 ? "Tem WhatsApp" : "Sem WhatsApp"} />
                        </span>
                        <span title={l.email ? l.email : "Sem e-mail"} className={cn("flex size-7 items-center justify-center rounded-lg", l.email ? "bg-azul/15 text-ciano" : "text-white/15")}>
                          <Mail className="size-4" aria-label={l.email ? "Tem e-mail" : "Sem e-mail"} />
                        </span>
                      </span>
                    </td>
                    <td className="hidden py-2.5 text-muted-foreground num xl:table-cell">{l.avaliacao_nota !== null ? `${l.avaliacao_nota.toFixed(1).replace(".", ",")}★ (${l.avaliacao_qtd})` : "—"}</td>
                    <td className="py-2.5">
                      <SeloPresenca statusSite={l.status_site} qualidade={l.site_qualidade} />
                    </td>
                    <td className="py-2.5">
                      <SeloEtapa etapa={l.etapa} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="flex justify-end">
                        <AnelScore score={l.score_oportunidade} tamanho={36} espessura={3.5} />
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões no celular */}
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {itens.map((l) => (
              <CartaoLead key={l.lead_id} lead={l} selecionado={selecao.tem(l.lead_id)} aoSelecionar={selecao.alternar} mostrarEtapa />
            ))}
          </div>

          {paginas > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Paginação">
              <button type="button" disabled={pagina <= 1} onClick={() => irPara(pagina - 1)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-fio disabled:opacity-40" aria-label="Página anterior">
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground num">
                Página {pagina} de {paginas}
              </span>
              <button type="button" disabled={pagina >= paginas} onClick={() => irPara(pagina + 1)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-fio disabled:opacity-40" aria-label="Próxima página">
                <ChevronRight className="size-4" />
              </button>
            </nav>
          )}
        </>
      )}

      <div className="h-16" />
      <BarraMassa ids={selecao.ids} aoLimpar={selecao.limpar} origem="leads" />
      <AnimatePresence>{modal && <ModalImportar tipo={modal} aoFechar={() => setModal(null)} />}</AnimatePresence>
    </div>
  );
}

function ModalImportar({ tipo, aoFechar }: { tipo: "csv" | "manual"; aoFechar: () => void }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({ nome: "", categoria: "", pais: "BR", estado: "", cidade: "", endereco: "", telefone: "", email: "", website: "", instagram: "", conteudo: "", categoriaPadrao: "", paisPadrao: "BR" });
  const set = (k: keyof typeof f, v: string) => setF((a) => ({ ...a, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const corpo =
        tipo === "csv"
          ? { tipo, conteudo: f.conteudo, paisPadrao: f.paisPadrao || null, categoriaPadrao: f.categoriaPadrao || "importado" }
          : { tipo, ...Object.fromEntries(Object.entries(f).filter(([k]) => !["conteudo", "categoriaPadrao", "paisPadrao"].includes(k))) };
      const r = await fetch("/api/leads/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json()) as { erro?: string; novos?: number; completados?: number; ignoradas?: number; suprimidos?: number; leadId?: string };
      if (!r.ok) {
        toast.error(d.erro ?? "Não foi possível importar.");
        return;
      }
      if (tipo === "manual" && d.leadId) {
        toast.success(d.novos ? "Lead adicionado." : "Essa empresa já existia — o registro foi completado.");
        router.push(`/leads/${d.leadId}`);
      } else {
        toast.success(`${d.novos} novos, ${d.completados} já existiam (completados), ${d.ignoradas} linhas ignoradas${d.suprimidos ? `, ${d.suprimidos} bloqueados pela supressão` : ""}.`);
        router.refresh();
      }
      aoFechar();
    } catch {
      toast.error("Falha de rede.");
    } finally {
      setEnviando(false);
    }
  }

  const c = "h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60";
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={aoFechar}>
      <motion.form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-fio bg-popover p-5"
        role="dialog"
        aria-modal="true"
        aria-label={tipo === "csv" ? "Importar CSV" : "Adicionar lead"}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{tipo === "csv" ? "Importar planilha CSV" : "Adicionar lead manualmente"}</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="flex size-8 items-center justify-center rounded-lg hover:bg-white/5">
            <X className="size-4" />
          </button>
        </div>
        {tipo === "csv" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Colunas reconhecidas (pt ou en): nome, categoria, telefone, email, site, instagram, endereço, cidade, estado, país, rating, reviews. Separador vírgula ou ponto e vírgula. Duplicatas são unificadas.</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const arq = e.target.files?.[0];
                if (arq) set("conteudo", await arq.text());
              }}
              className="block w-full text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border-0 file:bg-azul file:px-3 file:text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="rotulo">País padrão (sem coluna)</span>
                <input value={f.paisPadrao} onChange={(e) => set("paisPadrao", e.target.value.toUpperCase().slice(0, 2))} className={c} />
              </label>
              <label className="space-y-1">
                <span className="rotulo">Categoria padrão</span>
                <input value={f.categoriaPadrao} onChange={(e) => set("categoriaPadrao", e.target.value)} placeholder="barbearia" className={c} />
              </label>
            </div>
            {f.conteudo && <p className="text-xs text-muted-foreground">{f.conteudo.split(/\r?\n/).filter(Boolean).length - 1} linhas carregadas.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["nome", "Nome da empresa", true, 2],
                ["categoria", "Categoria", true, 1],
                ["pais", "País (ISO, ex.: BR)", true, 1],
                ["cidade", "Cidade", false, 1],
                ["estado", "Estado", false, 1],
                ["endereco", "Endereço", false, 2],
                ["telefone", "Telefone", false, 1],
                ["email", "E-mail", false, 1],
                ["website", "Site", false, 1],
                ["instagram", "Instagram", false, 1],
              ] as const
            ).map(([k, r, obrig, col]) => (
              <label key={k} className={cn("space-y-1", col === 2 && "col-span-2")}>
                <span className="rotulo">{r}</span>
                <input required={obrig} value={f[k]} onChange={(e) => set(k, k === "pais" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value)} className={c} />
              </label>
            ))}
          </div>
        )}
        <button type="submit" disabled={enviando || (tipo === "csv" && !f.conteudo)} className="mt-5 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-azul text-sm font-semibold text-white hover:bg-brilho disabled:opacity-50">
          {enviando && <LoaderCircle className="size-4 animate-spin" />} {tipo === "csv" ? "Importar" : "Adicionar lead"}
        </button>
      </motion.form>
    </motion.div>
  );
}
