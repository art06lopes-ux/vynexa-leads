"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, CircleDollarSign, Globe, LayoutDashboard, MessageCircle, Radar, Search, Sparkles, SquareKanban, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Telas do produto para dentro do MacBook, desenhadas na tela virtual de
 * 1280×800. Os dados são de demonstração (nomes inventados), só para
 * mostrar como o sistema se comporta — não são clientes reais.
 */

const ITENS_TRILHO = [LayoutDashboard, Radar, Users, SquareKanban, CircleDollarSign];

function Moldura({ ativo, titulo, children }: { ativo: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full bg-[#0b0a09] font-sans text-[#f5efe9]">
      <aside className="flex w-[84px] flex-col items-center gap-3 border-r border-white/[0.07] bg-[#0f0d0c] py-5">
        <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] font-display text-lg font-bold text-[#1a0700]">V</span>
        {ITENS_TRILHO.map((Icone, i) => (
          <span key={i} className={cn("flex size-12 items-center justify-center rounded-2xl", i === ativo ? "bg-gradient-to-b from-[#ff7a45] to-[#e8470f] text-[#1a0700] shadow-[0_8px_24px_-8px_rgba(255,90,31,0.9)]" : "text-white/45")}>
            <Icone className="size-5" />
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-7">
          <span className="flex h-11 w-[380px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[15px] text-white/40">
            <Search className="size-4" /> Procurar empresa, cliente ou tela…
          </span>
          <span className="ml-auto flex size-11 items-center justify-center rounded-xl border border-white/[0.08] text-white/60">
            <Bell className="size-5" />
          </span>
          <span className="flex size-11 items-center justify-center rounded-full border border-[#ff5a1f]/40 bg-[#ff5a1f]/15 font-bold text-[#ffb347]">V</span>
        </header>
        <div className="min-h-0 flex-1 p-7">
          <p className="font-display text-[30px] font-semibold tracking-tight">{titulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Contador que sobe de 0 até `ate` quando a tela fica ativa. */
function Sobe({ ate, ativa, atraso = 0 }: { ate: number; ativa: boolean; atraso?: number }) {
  const [n, setN] = useState(0);
  const reduzir = useReducedMotion();
  useEffect(() => {
    if (!ativa) return;
    if (reduzir) {
      const t0 = setTimeout(() => setN(ate), 0);
      return () => clearTimeout(t0);
    }
    let quadro = 0;
    const inicio = performance.now() + atraso;
    const passo = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - inicio) / 1800));
      setN(Math.round(ate * (1 - Math.pow(1 - p, 3))));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ativa, ate, atraso, reduzir]);
  return <>{ativa ? n : 0}</>;
}

// ── Radar ──────────────────────────────────────────────────────────────

const PINOS: Array<{ x: number; y: number; tipo: "sem" | "rede" | "tem" }> = [
  { x: 22, y: 30, tipo: "sem" }, { x: 35, y: 22, tipo: "rede" }, { x: 48, y: 40, tipo: "sem" }, { x: 30, y: 55, tipo: "tem" },
  { x: 60, y: 28, tipo: "sem" }, { x: 66, y: 52, tipo: "rede" }, { x: 42, y: 66, tipo: "sem" }, { x: 55, y: 72, tipo: "tem" },
  { x: 74, y: 38, tipo: "sem" }, { x: 18, y: 64, tipo: "rede" }, { x: 52, y: 18, tipo: "sem" }, { x: 79, y: 64, tipo: "sem" },
  { x: 38, y: 44, tipo: "rede" }, { x: 63, y: 82, tipo: "sem" }, { x: 27, y: 78, tipo: "tem" }, { x: 46, y: 54, tipo: "sem" },
];
const COR_PINO = { sem: "#ff5a1f", rede: "#ffb347", tem: "#6b6560" };

export function TelaRadar({ ativa }: { ativa: boolean }) {
  return (
    <Moldura ativo={1} titulo="Radar de empresas">
      <div className="mt-5 grid h-[560px] grid-cols-[1fr_330px] gap-5">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#14110f]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-60" aria-hidden="true">
            {[12, 26, 41, 58, 73, 88].map((v) => (
              <line key={`h${v}`} x1="0" y1={v} x2="100" y2={v + 4} stroke="#2b2522" strokeWidth="1.2" />
            ))}
            {[15, 33, 50, 69, 86].map((v) => (
              <line key={`v${v}`} x1={v} y1="0" x2={v - 5} y2="100" stroke="#2b2522" strokeWidth="1.2" />
            ))}
            <path d="M0 70 Q 30 60 55 75 T 100 66" stroke="#1d3b4a" strokeWidth="5" fill="none" opacity="0.7" />
          </svg>
          {/* área e varredura */}
          <motion.div
            className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff5a1f]/60 bg-[#ff5a1f]/[0.06]"
            animate={ativa ? { scale: [0.96, 1.02, 0.96] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "conic-gradient(from 0deg, rgba(255,90,31,0.35), transparent 70deg)" }}
            animate={ativa ? { rotate: 360 } : {}}
            transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
          />
          {PINOS.map((p, i) => (
            <motion.span
              key={`${i}-${ativa}`}
              className="absolute -ml-2.5 -mt-2.5 size-5 rounded-full border-2 border-[#0b0a09]"
              style={{ left: `${p.x}%`, top: `${p.y}%`, background: COR_PINO[p.tipo], boxShadow: p.tipo === "sem" ? "0 0 18px rgba(255,90,31,0.9)" : undefined }}
              initial={{ scale: 0, opacity: 0 }}
              animate={ativa ? { scale: [0, 1.5, 1], opacity: 1 } : {}}
              transition={{ delay: 0.3 + i * 0.16, duration: 0.5 }}
            />
          ))}
          <div className="absolute bottom-5 left-5 flex gap-4 rounded-xl bg-black/60 px-4 py-2.5 text-[14px] backdrop-blur">
            {(["sem", "rede", "tem"] as const).map((t) => (
              <span key={t} className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: COR_PINO[t] }} />
                {t === "sem" ? "Sem site" : t === "rede" ? "Só Instagram / iFood" : "Tem site"}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-[#ff5a1f]/40 bg-gradient-to-br from-[#8a2306] via-[#c4360a] to-[#ff6a2e] p-5">
            <p className="text-[14px] font-semibold text-white/80">Mapeando agora</p>
            <p className="mt-1 font-display text-[24px] font-semibold leading-tight text-white">Barbearias · raio de 5 km</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
              <motion.div className="h-full rounded-full bg-white" initial={{ width: "0%" }} animate={ativa ? { width: "100%" } : {}} transition={{ duration: 3, ease: "easeOut" }} />
            </div>
          </div>
          {[
            { rotulo: "Empresas encontradas", n: 84, cor: "text-white" },
            { rotulo: "Sem site nenhum", n: 37, cor: "text-[#ff7a45]" },
            { rotulo: "Só rede social ou app", n: 21, cor: "text-[#ffb347]" },
          ].map((k, i) => (
            <div key={k.rotulo} className="rounded-3xl border border-white/[0.08] bg-[#14110f] p-5">
              <p className="text-[15px] text-white/55">{k.rotulo}</p>
              <p className={cn("font-display text-[44px] font-semibold leading-none tabular-nums", k.cor)}>
                <Sobe ate={k.n} ativa={ativa} atraso={300 + i * 250} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  );
}

// ── Leads ──────────────────────────────────────────────────────────────

const LEADS = [
  { nome: "Barbearia Navalha de Ouro", cat: "Barbearia", selo: "Só agenda online", score: 92 },
  { nome: "Burger do Bairro", cat: "Hamburgueria", selo: "Só cardápio online", score: 88 },
  { nome: "Studio Unhas Bela", cat: "Manicure", selo: "Só Instagram", score: 81 },
  { nome: "Oficina Ponto Certo", cat: "Oficina mecânica", selo: "Sem site", score: 77 },
  { nome: "Açaí da Praça", cat: "Açaíteria", selo: "Só cardápio online", score: 73 },
];

function Anel({ valor, ativa, atraso }: { valor: number; ativa: boolean; atraso: number }) {
  const c = 2 * Math.PI * 22;
  return (
    <svg viewBox="0 0 52 52" className="size-[52px] -rotate-90" aria-hidden="true">
      <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
      <motion.circle
        cx="26" cy="26" r="22" stroke="url(#gradAnel)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={ativa ? { strokeDashoffset: c * (1 - valor / 100) } : {}}
        transition={{ delay: atraso, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <defs>
        <linearGradient id="gradAnel" x1="0" x2="1">
          <stop offset="0" stopColor="#ff5a1f" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TelaLeads({ ativa }: { ativa: boolean }) {
  return (
    <Moldura ativo={2} titulo="Leads para abordar">
      <div className="mt-5 grid grid-cols-[1fr_400px] gap-5">
        <div className="space-y-3">
          {LEADS.map((l, i) => (
            <motion.div
              key={`${l.nome}-${ativa}`}
              className={cn("flex items-center gap-4 rounded-2xl border bg-[#14110f] px-5 py-3.5", i === 0 ? "border-[#ff5a1f]/50" : "border-white/[0.07]")}
              initial={{ opacity: 0, x: -30 }}
              animate={ativa ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.13, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative">
                <Anel valor={l.score} ativa={ativa} atraso={0.4 + i * 0.13} />
                <span className="absolute inset-0 flex items-center justify-center font-display text-[16px] font-semibold">{l.score}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-semibold">{l.nome}</p>
                <p className="text-[14px] text-white/50">{l.cat}</p>
              </div>
              <span className="rounded-full bg-[#ff5a1f]/15 px-3 py-1 text-[13px] font-semibold text-[#ff9a6a]">{l.selo}</span>
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#25d366]/15 text-[#25d366]">
                <MessageCircle className="size-5" />
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          key={`ia-${ativa}`}
          className="rounded-3xl border border-white/[0.08] bg-[#14110f] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={ativa ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold text-[#ffb347]">
            <Sparkles className="size-4" /> Mensagem sugerida pela IA
          </p>
          <p className="mt-1 text-[14px] text-white/45">Barbearia Navalha de Ouro · WhatsApp</p>
          <div className="mt-5 rounded-2xl rounded-tl-sm bg-[#1f5c3d] p-4 text-[17px] leading-relaxed text-white">
            <Digita ativa={ativa} texto="Oi! Vi que a agenda de vocês fica só no app. Um site próprio com o agendamento e as fotos dos cortes ajuda a aparecer no Google. Posso te mostrar um exemplo?" />
          </div>
          <div className="mt-5 flex gap-2">
            <span className="flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] text-[15px] font-bold text-[#1a0700]">Abrir no WhatsApp</span>
            <span className="flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-[15px]">Outra versão</span>
          </div>
        </motion.div>
      </div>
    </Moldura>
  );
}

function Digita({ texto, ativa }: { texto: string; ativa: boolean }) {
  const [n, setN] = useState(0);
  const reduzir = useReducedMotion();
  useEffect(() => {
    if (!ativa) return;
    if (reduzir) {
      const t0 = setTimeout(() => setN(texto.length), 0);
      return () => clearTimeout(t0);
    }
    let i = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      id = setInterval(() => {
        i += 2;
        setN(Math.min(i, texto.length));
        if (i >= texto.length && id) clearInterval(id);
      }, 28);
    }, 1500);
    return () => {
      clearTimeout(t);
      if (id) clearInterval(id);
    };
  }, [ativa, texto, reduzir]);
  const visivel = ativa ? n : 0;
  return (
    <>
      {texto.slice(0, visivel)}
      {visivel < texto.length && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-white/80" />}
    </>
  );
}

// ── CRM ────────────────────────────────────────────────────────────────

const COLUNAS = ["Abordado", "Respondeu", "Negociando", "Fechado"];

export function TelaCRM({ ativa }: { ativa: boolean }) {
  const [fechou, setFechou] = useState(false);
  useEffect(() => {
    if (!ativa) return;
    const t0 = setTimeout(() => setFechou(false), 0);
    const t = setTimeout(() => setFechou(true), 1400);
    return () => {
      clearTimeout(t0);
      clearTimeout(t);
    };
  }, [ativa]);
  const cartoes: Record<string, Array<{ nome: string; valor: string }>> = {
    Abordado: [
      { nome: "Pizzaria Forno a Lenha", valor: "R$ 900" },
      { nome: "Pet Shop Amigo Fiel", valor: "R$ 1.100" },
    ],
    Respondeu: [{ nome: "Clínica Sorriso Leve", valor: "R$ 1.800" }],
    Negociando: fechou ? [{ nome: "Studio Unhas Bela", valor: "R$ 750" }] : [{ nome: "Studio Unhas Bela", valor: "R$ 750" }, { nome: "Burger do Bairro", valor: "R$ 1.200" }],
    Fechado: fechou ? [{ nome: "Burger do Bairro", valor: "R$ 1.200" }, { nome: "Açaí da Praça", valor: "R$ 650" }] : [{ nome: "Açaí da Praça", valor: "R$ 650" }],
  };
  return (
    <Moldura ativo={3} titulo="CRM">
      <div className="relative mt-5 grid h-[560px] grid-cols-4 gap-4">
        {COLUNAS.map((col) => (
          <div key={col} className={cn("rounded-3xl border p-4", col === "Fechado" ? "border-[#34d399]/30 bg-[#34d399]/[0.05]" : "border-white/[0.07] bg-[#14110f]")}>
            <p className="mb-3 flex items-center justify-between text-[15px] font-semibold">
              {col} <span className="rounded-full bg-white/[0.07] px-2 text-[13px] text-white/60">{cartoes[col].length}</span>
            </p>
            <div className="space-y-3">
              {cartoes[col].map((c) => (
                <motion.div key={c.nome} layout layoutId={`crm-${c.nome}`} transition={{ type: "spring", stiffness: 160, damping: 22 }} className="rounded-2xl border border-white/[0.08] bg-[#1b1714] p-4">
                  <p className="text-[16px] font-semibold">{c.nome}</p>
                  <p className="mt-1 text-[14px] text-white/50">Site institucional</p>
                  <p className="mt-3 font-display text-[18px] font-semibold text-[#ffb347]">{c.valor}</p>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
        <AnimatePresence>
          {fechou && ativa && (
            <motion.div
              className="absolute bottom-6 right-6 flex items-center gap-4 rounded-2xl border border-[#34d399]/40 bg-[#0f1f18] px-6 py-4 shadow-2xl"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-[#34d399]/20 text-[#34d399]">
                <CircleDollarSign className="size-6" />
              </span>
              <span>
                <span className="block text-[15px] text-white/60">Venda fechada</span>
                <span className="block font-display text-[24px] font-semibold">R$ 1.200,00</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Moldura>
  );
}

export function TelaSite({ ativa }: { ativa: boolean }) {
  return (
    <Moldura ativo={0} titulo="Bom dia, Rafa.">
      <div className="mt-5 grid grid-cols-3 gap-4">
        {[
          { r: "Leads novos hoje", v: 48, i: Users },
          { r: "Abordados na semana", v: 63, i: MessageCircle },
          { r: "Sites vendidos no mês", v: 7, i: Globe },
        ].map((k, idx) => (
          <div key={k.r} className="rounded-3xl border border-white/[0.08] bg-[#14110f] p-5">
            <k.i className="size-5 text-[#ffb347]" />
            <p className="mt-3 text-[15px] text-white/55">{k.r}</p>
            <p className="font-display text-[40px] font-semibold leading-none tabular-nums">
              <Sobe ate={k.v} ativa={ativa} atraso={idx * 200} />
            </p>
          </div>
        ))}
      </div>
    </Moldura>
  );
}
