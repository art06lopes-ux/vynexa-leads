"use client";

import { motion } from "framer-motion";
import { Archive, CalendarClock, Download, ExternalLink, Globe, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { Projeto } from "@/db/carteira";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { PORTFOLIO_INICIAL } from "@/lib/portfolio-inicial";
import { ROTULO_STATUS_PROJETO, ROTULO_TIPO, type StatusProjeto } from "@/lib/projetos";
import { cn } from "@/lib/utils";

import { FormProjeto, type OpcaoCliente } from "./form-projeto";

/**
 * Portfólio: cada projeto com a captura da página no ar, o status de
 * entrega, prazo e margem. A captura vem do mShots (WordPress.com),
 * gratuito e sem chave — na primeira vez demora alguns segundos.
 */

const ABAS = [
  ["todos", "Todos"],
  ["publicado", "Publicados"],
  ["andamento", "Em andamento"],
  ["arquivado", "Arquivados"],
] as const;
type Aba = (typeof ABAS)[number][0];

const EM_ANDAMENTO: StatusProjeto[] = ["briefing", "desenvolvimento", "revisao"];

const COR_STATUS: Record<StatusProjeto, string> = {
  briefing: "bg-white/10 text-foreground",
  desenvolvimento: "bg-ciano/15 text-ciano",
  revisao: "bg-aviso/15 text-aviso",
  publicado: "bg-sucesso/15 text-sucesso",
  arquivado: "bg-white/5 text-muted-foreground",
};

function captura(url: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1200&h=750`;
}

/**
 * O mShots devolve primeiro uma imagem de "gerando" (400 px); a captura
 * real chega numa nova requisição segundos depois. Enquanto isso, o V.
 */
function CapturaSite({ url }: { url: string }) {
  const [tentativa, setTentativa] = useState(0);
  const [pronta, setPronta] = useState(false);
  const src = `${captura(url)}${tentativa ? `&t=${tentativa}` : ""}`;
  return (
    <>
      {!pronta && (
        <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(70%_80%_at_80%_0%,rgba(255,90,31,0.22),transparent)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- marca */}
          <img src="/marca/v-brasa-96.png" alt="" className="size-12 animate-pulse opacity-70" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- captura externa gerada sob demanda */}
      <img
        src={src}
        alt={`Captura de ${dominio(url)}`}
        loading="lazy"
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth > 400) setPronta(true);
          else if (tentativa < 6) setTimeout(() => setTentativa((t) => t + 1), 4000);
        }}
        className={cn("size-full object-cover object-top transition-[transform,opacity] duration-500 group-hover:scale-[1.03]", pronta ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}

function dominio(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function prazoTexto(prazo: string): { texto: string; atrasado: boolean } {
  const dias = Math.round((new Date(`${prazo}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return { texto: `Atrasado ${-dias} ${dias === -1 ? "dia" : "dias"}`, atrasado: true };
  if (dias === 0) return { texto: "Entrega hoje", atrasado: false };
  return { texto: `Entrega em ${dias} ${dias === 1 ? "dia" : "dias"}`, atrasado: false };
}

export function TelaSites({ projetos, clientes }: { projetos: Projeto[]; clientes: OpcaoCliente[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [aba, setAba] = useState<Aba>("todos");
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [importando, setImportando] = useState(false);

  // /sites?novo=1 (atalho do Início e da paleta) abre o formulário.
  useEffect(() => {
    if (params.get("novo") !== "1") return;
    const t = setTimeout(() => {
      setEditando(null);
      setFormAberto(true);
      router.replace("/sites", { scroll: false });
    }, 0);
    return () => clearTimeout(t);
  }, [params, router]);

  const contagem = useMemo(
    () => ({
      todos: projetos.filter((p) => p.status !== "arquivado").length,
      publicado: projetos.filter((p) => p.status === "publicado").length,
      andamento: projetos.filter((p) => EM_ANDAMENTO.includes(p.status)).length,
      arquivado: projetos.filter((p) => p.status === "arquivado").length,
    }),
    [projetos],
  );

  const visiveis = projetos.filter((p) =>
    aba === "todos" ? p.status !== "arquivado" : aba === "andamento" ? EM_ANDAMENTO.includes(p.status) : p.status === aba,
  );

  const existentes = new Set(projetos.map((p) => (p.url ?? "").replace(/\/+$/, "").toLowerCase()));
  const paraImportar = PORTFOLIO_INICIAL.filter((s) => !existentes.has(s.url.toLowerCase()));

  async function importar() {
    setImportando(true);
    let ok = 0;
    for (const s of paraImportar) {
      const r = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: s.nome, clienteNome: s.cliente, tipo: s.tipo, status: s.status, url: s.url, valor: s.valor ?? "", custo: "", observacoes: s.observacoes }),
      }).catch(() => null);
      if (r?.ok) ok += 1;
    }
    setImportando(false);
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? "site importado" : "sites importados"} para o portfólio.`);
    else toast.error("Não foi possível importar agora.");
    router.refresh();
  }

  async function mudarStatus(p: Projeto, status: StatusProjeto) {
    const r = await fetch(`/api/projetos/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) {
      toast.success(status === "arquivado" ? "Projeto arquivado." : "Projeto reativado.");
      router.refresh();
    } else toast.error("Não foi possível mudar o status.");
  }

  async function excluir(p: Projeto) {
    if (!window.confirm(`Excluir "${p.nome}" do portfólio? Isso não pode ser desfeito.`)) return;
    const r = await fetch(`/api/projetos/${p.id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Projeto excluído.");
      router.refresh();
    } else toast.error("Não foi possível excluir.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-fio bg-placa p-1" role="tablist" aria-label="Filtrar projetos">
          {ABAS.map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={aba === v}
              onClick={() => setAba(v)}
              className={cn("relative h-9 cursor-pointer rounded-xl px-3.5 text-sm font-semibold transition-colors", aba === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}
            >
              {aba === v && <motion.span layoutId="aba-sites" className="absolute inset-0 rounded-xl bg-azul" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">
                {r} <span className="num opacity-70">{contagem[v]}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setFormAberto(true);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-sobre-brasa hover:bg-brilho"
        >
          <Plus className="size-4" /> Adicionar projeto
        </button>
      </div>

      {projetos.length === 0 && paraImportar.length > 0 && (
        <div className="heroi-escuro flex flex-col gap-4 rounded-3xl border border-brilho/25 p-5 sm:flex-row sm:items-center">
          <span className="pastilha size-12 shrink-0">
            <Download className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Você já tem {paraImportar.length} projetos no ar.</p>
            <p className="text-sm text-muted-foreground">
              {paraImportar
                .slice(0, 5)
                .map((s) => s.nome.split(" — ")[0])
                .join(", ")}
              {paraImportar.length > 5 ? ` e mais ${paraImportar.length - 5}` : ""}. Importe de uma vez — os valores ficam zerados para você conferir, exceto o da GN Celulares.
            </p>
          </div>
          <button type="button" onClick={() => void importar()} disabled={importando} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[#fff4ea] px-4 text-sm font-semibold text-sobre-brasa hover:bg-white disabled:opacity-60">
            {importando ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Importar meus sites
          </button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="placa flex flex-col items-center px-6 py-14 text-center">
          <span className="pastilha mb-3 size-12">
            <Globe className="size-5" />
          </span>
          <p className="font-semibold">{aba === "todos" ? "Nenhum projeto ainda" : "Nada nesta aba"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Cada site, landing page ou sistema que você entregar entra aqui com a captura da página e a margem.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((p) => {
            const prazo = p.prazo && p.status !== "publicado" && p.status !== "arquivado" ? prazoTexto(p.prazo) : null;
            const margem = p.valor_centavos - p.custo_centavos;
            return (
              <li key={p.id} className="placa group flex flex-col overflow-hidden p-0">
                <div className="relative aspect-[16/10] overflow-hidden border-b border-fio bg-tinta">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${dominio(p.url)}`}>
                      <CapturaSite url={p.url} />
                    </a>
                  ) : (
                    <div className="flex size-full items-center justify-center bg-[radial-gradient(70%_80%_at_80%_0%,rgba(255,90,31,0.25),transparent)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- marca */}
                      <img src="/marca/v-brasa-96.png" alt="" className="size-14 opacity-80" />
                    </div>
                  )}
                  <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold backdrop-blur", COR_STATUS[p.status])}>{ROTULO_STATUS_PROJETO[p.status]}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ROTULO_TIPO[p.tipo]} · {p.empresa ?? p.cliente_nome ?? "Sem cliente"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => { setEditando(p); setFormAberto(true); }} aria-label={`Editar ${p.nome}`} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => void mudarStatus(p, p.status === "arquivado" ? "publicado" : "arquivado")} aria-label={p.status === "arquivado" ? `Reativar ${p.nome}` : `Arquivar ${p.nome}`} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground">
                        <Archive className="size-4" />
                      </button>
                      <button type="button" onClick={() => void excluir(p)} aria-label={`Excluir ${p.nome}`} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-perigo">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-ciano hover:underline">
                      {dominio(p.url)} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                  {p.observacoes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{p.observacoes}</p>}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    {prazo ? (
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", prazo.atrasado ? "text-perigo" : "text-muted-foreground")}>
                        <CalendarClock className="size-3.5" /> {prazo.texto}
                      </span>
                    ) : (
                      <span />
                    )}
                    {p.valor_centavos > 0 && (
                      <span className="text-right text-xs text-muted-foreground">
                        <span className="valor-sensivel block font-display text-base font-semibold text-foreground num">{formatarDinheiro(p.valor_centavos)}</span>
                        {p.custo_centavos > 0 && <span className="valor-sensivel num">margem {formatarDinheiro(margem)}</span>}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormProjeto aberto={formAberto} aoFechar={() => setFormAberto(false)} projeto={editando} clientes={clientes} />
    </div>
  );
}
