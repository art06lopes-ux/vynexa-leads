"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, FileUp, Filter, LoaderCircle, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BarraMassa, SeletorQuantidade, useSelecao } from "@/components/leads/barra-massa";
import { Avatar, CartaoLead } from "@/components/leads/cartao-lead";
import { SeloEtapa, SeloPresenca } from "@/components/leads/presenca";
import { AnelScore } from "@/components/leads/score";
import type { LeadListado } from "@/db/leads";
import { cn } from "@/lib/utils";
import { ETAPAS, ROTULO_ETAPA } from "@/services/crm";

/**
 * Lista de leads: filtros na URL (dá para salvar e compartilhar o link),
 * tabela no desktop e cartões no celular, seleção em massa e exportação.
 */

const campo = "h-9 rounded-lg border border-fio bg-placa px-2.5 text-sm outline-none focus:border-brilho/60";

export function TelaLeads({ itens, total, pagina, porPagina, opcoes }: { itens: LeadListado[]; total: number; pagina: number; porPagina: number; opcoes: { categorias: string[]; paises: string[]; cidades: string[] } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selecao = useSelecao();
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [modal, setModal] = useState<null | "csv" | "manual">(null);

  const valor = (k: string) => params.get(k) ?? "";
  function definir(k: string, v: string) {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("pagina");
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
  const ativos = ["categoria", "pais", "cidade", "site", "etapa", "prioridade", "fonte", "whatsapp", "email", "scoreMin", "q", "busca"].filter((k) => params.get(k)).length;

  const filtros = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={valor("site")} onChange={(e) => definir("site", e.target.value)} className={campo} aria-label="Site">
        <option value="">Site: todos</option>
        <option value="sem">Sem site</option>
        <option value="social">Só redes sociais</option>
        <option value="ruim">Site fraco</option>
        <option value="com">Com site</option>
      </select>
      <select value={valor("etapa")} onChange={(e) => definir("etapa", e.target.value)} className={campo} aria-label="Etapa">
        <option value="">Etapa: todas</option>
        {ETAPAS.map((e) => (
          <option key={e} value={e}>
            {ROTULO_ETAPA[e]}
          </option>
        ))}
      </select>
      <select value={valor("prioridade")} onChange={(e) => definir("prioridade", e.target.value)} className={campo} aria-label="Prioridade">
        <option value="">Prioridade</option>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </select>
      <select value={valor("categoria")} onChange={(e) => definir("categoria", e.target.value)} className={cn(campo, "max-w-48")} aria-label="Categoria">
        <option value="">Categoria</option>
        {opcoes.categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select value={valor("cidade")} onChange={(e) => definir("cidade", e.target.value)} className={cn(campo, "max-w-44")} aria-label="Cidade">
        <option value="">Cidade</option>
        {opcoes.cidades.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select value={valor("fonte")} onChange={(e) => definir("fonte", e.target.value)} className={campo} aria-label="Fonte">
        <option value="">Fonte</option>
        <option value="google_places">Google Maps</option>
        <option value="osm">OpenStreetMap</option>
        <option value="receita">Receita Federal</option>
        <option value="csv">CSV</option>
        <option value="manual">Manual</option>
      </select>
      <select value={valor("scoreMin")} onChange={(e) => definir("scoreMin", e.target.value)} className={campo} aria-label="Score mínimo">
        <option value="">Score</option>
        {[50, 60, 70, 80, 90].map((s) => (
          <option key={s} value={s}>
            {s}+
          </option>
        ))}
      </select>
      {(["whatsapp", "email"] as const).map((k) => (
        <button key={k} type="button" onClick={() => definir(k, valor(k) ? "" : "1")} aria-pressed={Boolean(valor(k))} className={cn(campo, "cursor-pointer", valor(k) && "border-brilho/60 bg-azul/15 text-ciano")}>
          {k === "whatsapp" ? "Com WhatsApp" : "Com e-mail"}
        </button>
      ))}
      <select value={valor("ordem")} onChange={(e) => definir("ordem", e.target.value)} className={campo} aria-label="Ordenar">
        <option value="">Ordenar: score</option>
        <option value="recentes">Mais recentes</option>
        <option value="avaliacoes">Mais avaliações</option>
        <option value="nome">Nome</option>
      </select>
      {ativos > 0 && (
        <button type="button" onClick={() => router.push(pathname)} className="inline-flex h-9 cursor-pointer items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3.5" /> Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeletorQuantidade consulta={consulta} total={total} aoSelecionar={selecao.definir} />
        <button type="button" onClick={() => setFiltrosMobile((a) => !a)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm lg:hidden">
          <Filter className="size-4" /> Filtros {ativos > 0 && <span className="rounded-full bg-azul px-1.5 text-[0.7rem] font-bold text-white">{ativos}</span>}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal("manual")} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
            <Plus className="size-4" /> Adicionar
          </button>
          <button type="button" onClick={() => setModal("csv")} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
            <FileUp className="size-4" /> Importar CSV
          </button>
          {(["csv", "xlsx", "json"] as const).map((f) => (
            <a key={f} href={`/api/exportar?formato=${f}&${consulta}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio bg-placa px-3 text-sm hover:border-brilho/40">
              <Download className="size-4" /> {f === "xlsx" ? "Excel" : f.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <div className="hidden lg:block">{filtros}</div>
      <AnimatePresence>
        {filtrosMobile && (
          <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFiltrosMobile(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl border-t border-fio bg-popover p-4 pb-8">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <p className="mb-3 font-display font-semibold">Filtros</p>
              {filtros}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground num">{total.toLocaleString("pt-BR")}</span> lead(s)
        {params.get("q") && (
          <>
            {" "}
            para &quot;<span className="text-foreground">{params.get("q")}</span>&quot;
          </>
        )}
      </p>

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
                  <th className="py-3 font-medium">Local</th>
                  <th className="py-3 font-medium">Avaliações</th>
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
                          <span className="block truncate text-xs text-muted-foreground">{l.categoria_rotulo ?? l.categoria}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-44 truncate py-2.5 text-muted-foreground">{[l.cidade, l.estado].filter(Boolean).join(", ") || l.pais}</td>
                    <td className="py-2.5 text-muted-foreground num">{l.avaliacao_nota !== null ? `${l.avaliacao_nota.toFixed(1).replace(".", ",")}★ (${l.avaliacao_qtd})` : "—"}</td>
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
