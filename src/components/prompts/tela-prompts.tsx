"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Copy, FileJson, FileText, Lightbulb, LoaderCircle, Save, Sparkles, Star, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { PromptSalvo } from "@/db/prompts";
import { BIBLIOTECA_PROMPTS } from "@/lib/biblioteca-prompts";
import { cn } from "@/lib/utils";
import { haQuantoTempo } from "@/services/crm";

/**
 * Gerador de prompts para usar com o Claude Code: uma ideia (ou um prompt
 * fraco) vira um pedido completo. Também guarda os que deram certo e
 * traz uma biblioteca de prompts prontos do dia a dia da Vynexa.
 */

type Aba = "criar" | "meus" | "biblioteca";
type Modo = "ideia" | "melhorar";
type Formato = "texto" | "json";
type Resultado = { titulo: string; saida: string; perguntas: string[]; modo: Modo; formato: Formato; entrada: string };

const LIMITE = 8000;

function BotaoCopiar({ texto, rotulo = "Copiar", className }: { texto: string; rotulo?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          toast.error("O navegador bloqueou a cópia. Selecione o texto e copie à mão.");
        }
      }}
      className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-fio bg-placa-2 px-3 text-sm font-semibold hover:border-brilho/40", className)}
    >
      {ok ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />} {ok ? "Copiado" : rotulo}
    </button>
  );
}

function Alternador<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: ReadonlyArray<readonly [T, string, React.ComponentType<{ className?: string }>]>; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-fio bg-tinta/60 p-1" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, r, Icone]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => aoMudar(v)}
          className={cn("relative flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors", valor === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}
        >
          {valor === v && <motion.span layoutId={`alt-${rotulo}`} className="absolute inset-0 rounded-xl bg-azul" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <Icone className="relative size-4" />
          <span className="relative truncate">{r}</span>
        </button>
      ))}
    </div>
  );
}

export function TelaPrompts({ salvos, iaOk }: { salvos: PromptSalvo[]; iaOk: boolean }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("criar");
  const [modo, setModo] = useState<Modo>("ideia");
  const [formato, setFormato] = useState<Formato>("texto");
  const [destino, setDestino] = useState<"claude-code" | "geral">("claude-code");
  const [entrada, setEntrada] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoId, setSalvoId] = useState<string | null>(null);

  async function gerar() {
    if (entrada.trim().length < 10) {
      toast.error("Escreva pelo menos uma frase sobre o que você quer.");
      return;
    }
    setGerando(true);
    setSalvoId(null);
    try {
      const r = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "gerar", modo, formato, destino, entrada }) });
      const d = (await r.json()) as { titulo?: string; saida?: string; perguntas?: string[]; erro?: string; codigo?: string };
      if (!r.ok || !d.saida) {
        toast.error(d.erro ?? "Não foi possível gerar agora.", d.codigo === "sem_configuracao" ? { action: { label: "Configurar", onClick: () => router.push("/configuracoes?aba=integracoes") } } : undefined);
        return;
      }
      setResultado({ titulo: d.titulo ?? "Prompt", saida: d.saida, perguntas: d.perguntas ?? [], modo, formato, entrada });
    } catch {
      toast.error("Falha de rede ao gerar.");
    } finally {
      setGerando(false);
    }
  }

  async function salvar() {
    if (!resultado) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "salvar", titulo: resultado.titulo, modo: resultado.modo, formato: resultado.formato, entrada: resultado.entrada, saida: resultado.saida }),
      });
      const d = (await r.json()) as { id?: string; erro?: string };
      if (!r.ok || !d.id) throw new Error(d.erro);
      setSalvoId(d.id);
      toast.success("Salvo em Meus prompts.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function favoritar(p: PromptSalvo) {
    const r = await fetch(`/api/prompts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorito: !p.favorito }) });
    if (r.ok) router.refresh();
  }

  async function excluir(p: PromptSalvo) {
    if (!window.confirm(`Excluir "${p.titulo}"?`)) return;
    const r = await fetch(`/api/prompts/${p.id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Prompt excluído.");
      router.refresh();
    }
  }

  function usarComoBase(texto: string) {
    setEntrada(texto.slice(0, LIMITE));
    setModo("melhorar");
    setResultado(null);
    setAba("criar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-fio bg-placa p-1" role="tablist" aria-label="Gerador de prompts">
        {(
          [
            ["criar", "Criar prompt"],
            ["meus", `Meus prompts · ${salvos.length}`],
            ["biblioteca", `Biblioteca · ${BIBLIOTECA_PROMPTS.length}`],
          ] as const
        ).map(([v, r]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={cn("relative h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold transition-colors", aba === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}>
            {aba === v && <motion.span layoutId="aba-prompts" className="absolute inset-0 rounded-xl bg-azul" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{r}</span>
          </button>
        ))}
      </div>

      {aba === "criar" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void gerar();
            }}
            className="placa flex flex-col gap-4 p-5"
          >
            <Alternador
              rotulo="Modo"
              valor={modo}
              aoMudar={setModo}
              opcoes={[
                ["ideia", "Criar a partir de uma ideia", Lightbulb],
                ["melhorar", "Melhorar meu prompt", Wand2],
              ]}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Alternador
                rotulo="Formato"
                valor={formato}
                aoMudar={setFormato}
                opcoes={[
                  ["texto", "Texto", FileText],
                  ["json", "JSON", FileJson],
                ]}
              />
              <label className="flex h-12 items-center gap-2 rounded-2xl border border-fio bg-tinta/60 px-3 text-sm">
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">Para</span>
                <select value={destino} onChange={(e) => setDestino(e.target.value as typeof destino)} className="h-full min-w-0 flex-1 cursor-pointer bg-transparent font-semibold outline-none">
                  <option value="claude-code" className="bg-popover">Claude Code (meus projetos)</option>
                  <option value="geral" className="bg-popover">Qualquer IA</option>
                </select>
              </label>
            </div>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                {modo === "ideia" ? "Descreva a ideia" : "Cole o seu prompt"}
                <span className={cn("num", entrada.length > LIMITE * 0.95 && "text-aviso")}>
                  {entrada.length.toLocaleString("pt-BR")} / {LIMITE.toLocaleString("pt-BR")}
                </span>
              </span>
              <textarea
                value={entrada}
                onChange={(e) => setEntrada(e.target.value.slice(0, LIMITE))}
                rows={12}
                placeholder={modo === "ideia" ? "Ex.: site para a barbearia Cabra Macho em Manacapuru, com agendamento pelo WhatsApp e galeria dos cortes" : "Cole aqui o prompt que você já tem…"}
                className="min-h-64 flex-1 resize-y rounded-2xl border border-fio bg-tinta/60 p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brilho/60"
              />
            </label>
            {!iaOk && <p className="rounded-xl border border-aviso/30 bg-aviso/10 px-3 py-2 text-xs text-aviso">A IA não está configurada. Cole a chave gratuita do Gemini em Configurações → Integrações.</p>}
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={gerando || entrada.trim().length < 10} className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-azul text-[0.95rem] font-semibold text-sobre-brasa shadow-[0_14px_34px_-12px_rgba(255,90,31,0.9)] hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50">
              {gerando ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {gerando ? "Escrevendo o prompt…" : modo === "ideia" ? "Gerar prompt" : "Melhorar prompt"}
            </motion.button>
          </form>

          <section className="placa flex min-h-[28rem] flex-col p-5" aria-labelledby="titulo-prompt-final" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 id="titulo-prompt-final" className="font-semibold">
                  Prompt final
                </h2>
                <p className="truncate text-xs text-muted-foreground">{resultado ? resultado.titulo : "Aparece aqui, pronto para copiar."}</p>
              </div>
              {resultado && (
                <div className="flex gap-2">
                  <BotaoCopiar texto={resultado.saida} />
                  <button type="button" onClick={() => void salvar()} disabled={salvando || salvoId !== null} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-azul px-3 text-sm font-semibold text-sobre-brasa hover:bg-brilho disabled:opacity-60">
                    {salvando ? <LoaderCircle className="size-4 animate-spin" /> : salvoId ? <Check className="size-4" /> : <Save className="size-4" />} {salvoId ? "Salvo" : "Salvar"}
                  </button>
                </div>
              )}
            </div>
            <AnimatePresence mode="wait">
              {gerando ? (
                <motion.div key="gerando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 flex-1 space-y-2.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="block h-3 animate-pulse rounded-full bg-white/6" style={{ width: `${55 + ((i * 37) % 45)}%` }} />
                  ))}
                </motion.div>
              ) : resultado ? (
                <motion.div key={resultado.saida.slice(0, 20)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-1 flex-col gap-3">
                  <pre className="max-h-[34rem] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-fio bg-tinta/70 p-4 font-mono text-[0.8rem] leading-relaxed text-foreground/90">{resultado.saida}</pre>
                  {resultado.perguntas.length > 0 && (
                    <div className="rounded-2xl border border-ciano/25 bg-ciano/8 p-3.5">
                      <p className="text-xs font-semibold text-ciano">Para ficar ainda melhor, responda no prompt:</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/85">
                        {resultado.perguntas.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-fio p-6 text-center">
                  <span className="pastilha mb-3 size-12">
                    <Sparkles className="size-5" />
                  </span>
                  <p className="font-semibold">Uma frase vira um pedido completo</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Contexto, requisitos, restrições, critérios de aceite e como testar — no formato que o Claude Code entende melhor.</p>
                  <button type="button" onClick={() => setAba("biblioteca")} className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-ciano hover:underline">
                    <BookOpen className="size-4" /> Ou comece por um prompt pronto
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      )}

      {aba === "meus" &&
        (salvos.length === 0 ? (
          <div className="placa px-6 py-14 text-center">
            <p className="font-semibold">Nenhum prompt salvo ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Gere um prompt e toque em Salvar — ele fica aqui para reusar.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {salvos.map((p) => (
              <li key={p.id} className="placa flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.modo === "ideia" ? "Da ideia" : "Melhorado"} · {p.formato === "json" ? "JSON" : "Texto"} · {haQuantoTempo(p.criado_em)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" onClick={() => void favoritar(p)} aria-label={p.favorito ? "Tirar dos favoritos" : "Favoritar"} aria-pressed={Boolean(p.favorito)} className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/5">
                      <Star className={cn("size-4", p.favorito ? "fill-ciano text-ciano" : "text-muted-foreground")} />
                    </button>
                    <button type="button" onClick={() => void excluir(p)} aria-label={`Excluir ${p.titulo}`} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-perigo">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <pre className="mt-3 max-h-48 flex-1 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-fio bg-tinta/60 p-3 font-mono text-[0.75rem] leading-relaxed text-foreground/80 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">{p.saida}</pre>
                <div className="mt-3 flex gap-2">
                  <BotaoCopiar texto={p.saida} />
                  <button type="button" onClick={() => usarComoBase(p.saida)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground">
                    <Wand2 className="size-4" /> Melhorar de novo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {aba === "biblioteca" && (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {BIBLIOTECA_PROMPTS.map((p) => (
            <li key={p.id} className="placa flex flex-col p-5">
              <p className="font-semibold">{p.titulo}</p>
              <p className="text-xs text-muted-foreground">{p.quando}</p>
              <pre className="mt-3 max-h-44 flex-1 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-fio bg-tinta/60 p-3 font-mono text-[0.75rem] leading-relaxed text-foreground/80 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">{p.texto}</pre>
              <div className="mt-3 flex gap-2">
                <BotaoCopiar texto={p.texto} />
                <button type="button" onClick={() => usarComoBase(p.texto)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground">
                  <Wand2 className="size-4" /> Adaptar com IA
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
