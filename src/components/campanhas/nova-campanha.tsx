"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail, Megaphone, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { lerParaCampanha } from "@/components/leads/barra-massa";
import { cn } from "@/lib/utils";

/**
 * Nova campanha em três passos: quem recebe → como enviar → revisar.
 * Os e-mails são escritos pela IA depois de criar; o envio só acontece
 * quando o operador autoriza, vendo os previews (tela da campanha).
 */

type Provedor = { nome: "gmail" | "resend" | "smtp"; rotulo: string; ok: boolean; motivo: string | null };
type Resumo = { total: number; comEmail: number; bloqueados: number; emNegociacao: number; categoria: string | null; cidade: string | null };

const campo = "h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60";

export function NovaCampanha({ provedores, provedorPadrao, categorias, cidades }: { provedores: Provedor[]; provedorPadrao: string; categorias: string[]; cidades: string[] }) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [origem, setOrigem] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [filtro, setFiltro] = useState({ categoria: "", cidade: "", site: "", scoreMin: "", limite: "50" });
  const [buscando, setBuscando] = useState(false);
  const [porFiltro, setPorFiltro] = useState(false);
  const [cfg, setCfg] = useState({ nome: "", descricao: "", provedor: provedorPadrao, ritmo: 20, limite: 80, followup: true, dias: "3, 7" });
  const [criando, setCriando] = useState(false);

  const resumir = useCallback(async (lista: string[]) => {
    if (lista.length === 0) {
      setResumo(null);
      return;
    }
    const r = await fetch("/api/leads/resumo-selecao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: lista }) });
    if (r.ok) {
      const d = (await r.json()) as Resumo;
      setResumo(d);
      setCfg((c) =>
        c.nome
          ? c
          : {
              ...c,
              nome: [d.categoria ? `${d.categoria}${filtro.site === "sem" ? " sem site" : ""}` : "Campanha", d.cidade].filter(Boolean).join(" — "),
            },
      );
    }
  }, [filtro.site]);

  useEffect(() => {
    // sessionStorage só existe no navegador: lido depois da montagem.
    const t = setTimeout(() => {
      const guardado = lerParaCampanha();
      if (guardado?.ids.length) {
        setIds(guardado.ids);
        setOrigem(guardado.origem);
        void resumir(guardado.ids);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarPorFiltro() {
    setBuscando(true);
    const p = new URLSearchParams({ limite: filtro.limite, ordem: "score", email: "1", naoContatar: "0" });
    if (filtro.categoria) p.set("categoria", filtro.categoria);
    if (filtro.cidade) p.set("cidade", filtro.cidade);
    if (filtro.site) p.set("site", filtro.site);
    if (filtro.scoreMin) p.set("scoreMin", filtro.scoreMin);
    try {
      const r = await fetch(`/api/leads/ids?${p.toString()}`);
      const d = (await r.json()) as { ids?: string[]; erro?: string };
      if (!r.ok || !d.ids) throw new Error(d.erro);
      setIds(d.ids);
      setOrigem("filtro");
      setCfg((c) => ({ ...c, nome: "" }));
      await resumir(d.ids);
      if (d.ids.length === 0) toast("Nenhum lead com e-mail casa com esse filtro.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha ao buscar leads.");
    } finally {
      setBuscando(false);
    }
  }

  async function criar() {
    const dias = cfg.followup
      ? cfg.dias
          .split(/[,\s]+/)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    setCriando(true);
    try {
      const r = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: cfg.nome,
          descricao: cfg.descricao || null,
          leadIds: ids,
          filtros: origem === "filtro" ? filtro : { origem },
          provedorEmail: cfg.provedor,
          ritmoPorHora: cfg.ritmo,
          limiteDiario: cfg.limite,
          followupDias: dias,
        }),
      });
      const d = (await r.json()) as { id?: string; erro?: string; incluidos?: number; semEmail?: number; bloqueados?: number };
      if (!r.ok || !d.id) throw new Error(d.erro ?? "Não foi possível criar a campanha.");
      try {
        sessionStorage.removeItem("vynexa:leads-para-campanha");
      } catch {
        /* ok */
      }
      toast.success(`Campanha criada com ${d.incluidos} lead(s). A IA está escrevendo os e-mails.`);
      router.push(`/campanhas/${d.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setCriando(false);
    }
  }

  const passos = ["Leads", "Envio", "Revisar"];
  const prov = provedores.find((p) => p.nome === cfg.provedor);

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 flex items-center gap-2">
        {passos.map((p, i) => (
          <li key={p} className="flex flex-1 items-center gap-2">
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors", i < passo ? "bg-sucesso text-[#03210f]" : i === passo ? "bg-azul text-white" : "bg-white/10 text-muted-foreground")}>
              {i < passo ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-sm", i === passo ? "font-semibold" : "text-muted-foreground")}>{p}</span>
            {i < passos.length - 1 && <span className="h-px flex-1 bg-fio" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={passo} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="placa p-5 sm:p-6">
          {passo === 0 && (
            <div className="space-y-5">
              {origem && origem !== "filtro" && ids.length > 0 && (
                <div className="rounded-xl border border-brilho/40 bg-azul/10 p-4 text-sm">
                  <p className="font-semibold">{ids.length} empresa(s) escolhida(s) em Leads.</p>
                  {!porFiltro && (
                    <button type="button" onClick={() => setPorFiltro(true)} className="mt-1 cursor-pointer text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                      Montar a lista por filtro em vez disso
                    </button>
                  )}
                </div>
              )}
              {(porFiltro || !origem || origem === "filtro" || ids.length === 0) && (
              <div>
                <p className="mb-3 font-display font-semibold">Escolher leads por filtro</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="rotulo">Categoria</span>
                    <input list="cats" value={filtro.categoria} onChange={(e) => setFiltro((f) => ({ ...f, categoria: e.target.value }))} className={campo} placeholder="Barbearia" />
                    <datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                  </label>
                  <label className="space-y-1">
                    <span className="rotulo">Cidade</span>
                    <input list="cids" value={filtro.cidade} onChange={(e) => setFiltro((f) => ({ ...f, cidade: e.target.value }))} className={campo} placeholder="Manacapuru" />
                    <datalist id="cids">{cidades.map((c) => <option key={c} value={c} />)}</datalist>
                  </label>
                  <label className="space-y-1">
                    <span className="rotulo">Site</span>
                    <select value={filtro.site} onChange={(e) => setFiltro((f) => ({ ...f, site: e.target.value }))} className={cn(campo, "cursor-pointer")}>
                      <option value="sem">Sem site</option>
                      <option value="ruim">Site fraco</option>
                      <option value="">Todos</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="rotulo">Score mínimo</span>
                      <input inputMode="numeric" value={filtro.scoreMin} onChange={(e) => setFiltro((f) => ({ ...f, scoreMin: e.target.value.replace(/\D/g, "") }))} className={campo} />
                    </label>
                    <label className="space-y-1">
                      <span className="rotulo">Quantos leads</span>
                      <select value={filtro.limite} onChange={(e) => setFiltro((f) => ({ ...f, limite: e.target.value }))} className={cn(campo, "cursor-pointer")}>
                        {[10, 25, 50, 100, 500, 1000].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <button type="button" onClick={buscarPorFiltro} disabled={buscando} className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
                  {buscando ? <LoaderCircle className="size-4 animate-spin" /> : <Users className="size-4" />} Montar lista
                </button>
              </div>
              )}
              {resumo && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Selecionados", resumo.total, ""],
                    ["Recebem e-mail", resumo.comEmail, "text-sucesso"],
                    ["Sem e-mail", resumo.total - resumo.comEmail - resumo.bloqueados - resumo.emNegociacao, "text-muted-foreground"],
                    ["Bloqueados / em negociação", resumo.bloqueados + resumo.emNegociacao, "text-aviso"],
                  ].map(([r, v, c]) => (
                    <div key={r as string} className="rounded-xl border border-fio p-3">
                      <p className={cn("font-display text-xl font-semibold num", c as string)}>{v as number}</p>
                      <p className="text-xs text-muted-foreground">{r as string}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {passo === 1 && (
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="rotulo">Nome da campanha</span>
                <input value={cfg.nome} onChange={(e) => setCfg((c) => ({ ...c, nome: e.target.value }))} className={campo} placeholder="Barbearias sem site — Manacapuru" />
              </label>
              <label className="block space-y-1">
                <span className="rotulo">Provedor de e-mail</span>
                <select value={cfg.provedor} onChange={(e) => setCfg((c) => ({ ...c, provedor: e.target.value }))} className={cn(campo, "cursor-pointer")}>
                  {provedores.map((p) => (
                    <option key={p.nome} value={p.nome}>
                      {p.rotulo} {p.ok ? "— pronto" : `— ${p.motivo}`}
                    </option>
                  ))}
                </select>
                {prov && !prov.ok && <span className="block text-xs text-aviso">Este provedor ainda não está pronto ({prov.motivo}). Você pode criar e preparar a campanha, mas só poderá autorizar o envio depois de configurá-lo.</span>}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="rotulo">Ritmo: {cfg.ritmo} e-mails por hora</span>
                  <input type="range" min={1} max={60} value={cfg.ritmo} onChange={(e) => setCfg((c) => ({ ...c, ritmo: Number(e.target.value) }))} className="h-10 w-full cursor-pointer accent-[#3366ff]" />
                </label>
                <label className="space-y-1">
                  <span className="rotulo">Limite por dia: {cfg.limite}</span>
                  <input type="range" min={5} max={300} step={5} value={cfg.limite} onChange={(e) => setCfg((c) => ({ ...c, limite: Number(e.target.value) }))} className="h-10 w-full cursor-pointer accent-[#3366ff]" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Nunca disparamos tudo de uma vez: os e-mails saem em fila, no ritmo acima, com pausa entre cada um — o que protege a reputação do seu domínio.</p>
              <div className="rounded-xl border border-fio p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={cfg.followup} onChange={(e) => setCfg((c) => ({ ...c, followup: e.target.checked }))} className="size-4 accent-[#3366ff]" />
                  Follow-ups automáticos para quem não responder
                </label>
                {cfg.followup && (
                  <label className="mt-3 block space-y-1">
                    <span className="rotulo">Dias depois do primeiro e-mail (até 3)</span>
                    <input value={cfg.dias} onChange={(e) => setCfg((c) => ({ ...c, dias: e.target.value }))} className={campo} placeholder="3, 7" />
                    <span className="block text-xs text-muted-foreground">A IA escreve os follow-ups junto com o primeiro e-mail; você vê tudo antes de autorizar. Quem responder ou pedir para sair não recebe.</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="pastilha size-10">
                  <Megaphone className="size-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold">{cfg.nome}</p>
                  <p className="text-muted-foreground">{resumo?.comEmail ?? 0} e-mails · {prov?.rotulo} · {cfg.ritmo}/hora, até {cfg.limite}/dia</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex gap-2"><Check className="size-4 text-sucesso" /> A IA escreve um e-mail personalizado para cada empresa.</li>
                {cfg.followup && <li className="flex gap-2"><Check className="size-4 text-sucesso" /> Follow-ups nos dias {cfg.dias}.</li>}
                <li className="flex gap-2"><Check className="size-4 text-sucesso" /> Você revisa os previews e só então autoriza o envio.</li>
                <li className="flex gap-2"><Check className="size-4 text-sucesso" /> Todo e-mail leva link para não receber mais mensagens.</li>
              </ul>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-between">
        <button type="button" onClick={() => (passo === 0 ? router.push("/campanhas") : setPasso((p) => p - 1))} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
          <ArrowLeft className="size-4" /> {passo === 0 ? "Cancelar" : "Voltar"}
        </button>
        {passo < 2 ? (
          <button
            type="button"
            disabled={(passo === 0 && (!resumo || resumo.comEmail === 0)) || (passo === 1 && cfg.nome.trim().length < 3)}
            onClick={() => setPasso((p) => p + 1)}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-5 text-sm font-semibold text-white hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar <ArrowRight className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={criar} disabled={criando} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-5 text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60">
            {criando ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} Criar e gerar e-mails
          </button>
        )}
      </div>
    </div>
  );
}
