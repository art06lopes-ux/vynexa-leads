"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { ArrowRight, Check, ChevronDown, MessageCircle, PlayCircle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Marca } from "@/components/marca";
import { EsculturaV } from "@/components/marca/escultura-v";
import { COMPARATIVO, formatarPreco, type Plano } from "@/lib/planos";
import { cn } from "@/lib/utils";

import { MacBook, TelaVirtual } from "./macbook";
import { TelaCRM, TelaLeads, TelaRadar } from "./telas";

type Props = { planos: Plano[]; diasTeste: number; whatsapp: string | null };

const botaoBrasa =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] px-6 text-[0.95rem] font-bold text-sobre-brasa shadow-[0_14px_40px_-12px_rgba(255,90,31,0.95)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb347]";
const botaoFio = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 text-[0.95rem] font-semibold transition-colors hover:border-[#ffb347]/50 hover:bg-white/[0.03]";

// ── Topo ───────────────────────────────────────────────────────────────

function Topo() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b0a09]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/conheca" aria-label="Vynexa Leads">
          <Marca />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Seções">
          <a href="#como-funciona" className="hover:text-foreground">
            Como funciona
          </a>
          <a href="#o-que-enxerga" className="hover:text-foreground">
            O que ele enxerga
          </a>
          <a href="#planos" className="hover:text-foreground">
            Planos
          </a>
          <a href="#perguntas" className="hover:text-foreground">
            Perguntas
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex">
            Entrar
          </Link>
          <Link href="/cadastro" className="inline-flex h-10 items-center rounded-xl bg-gradient-to-b from-[#ff7a45] to-[#e8470f] px-4 text-sm font-bold text-sobre-brasa">
            Testar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Herói ──────────────────────────────────────────────────────────────

function Heroi({ diasTeste }: { diasTeste: number }) {
  const reduzir = useReducedMotion();
  const palavras = ["Ache", "quem", "precisa", "de", "um", "site", "antes", "do", "seu", "concorrente."];
  return (
    <section className="relative overflow-hidden pb-10 pt-14 sm:pt-20">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-20%] -z-10 h-[46rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,90,31,0.28),transparent)]" />
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <motion.p
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#ff5a1f]/35 bg-[#ff5a1f]/10 px-3.5 py-1.5 text-[0.8rem] font-semibold text-[#ffb347]"
          initial={reduzir ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Sparkles className="size-3.5" aria-hidden="true" /> Prospecção para quem vende sites e sistemas
        </motion.p>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[4.6rem]">
          {palavras.map((p, i) => (
            <motion.span
              key={i}
              className="inline-block pr-[0.22em]"
              initial={reduzir ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.08 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {p}
            </motion.span>
          ))}
        </h1>
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          initial={reduzir ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          O Vynexa Leads varre o mapa da sua cidade, mostra quais empresas não têm site — ou só têm Instagram, iFood ou agenda de app — e escreve a mensagem para você chamar no WhatsApp.
        </motion.p>
        <motion.div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" initial={reduzir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
          <Link href="/cadastro" className={botaoBrasa}>
            {diasTeste > 0 ? `Testar ${diasTeste} dias grátis` : "Criar minha conta"} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a href="#como-funciona" className={botaoFio}>
            <PlayCircle className="size-4" aria-hidden="true" /> Ver como funciona
          </a>
        </motion.div>
        <p className="mt-3 text-xs text-muted-foreground">Sem cartão para testar · Cancele quando quiser</p>
      </div>

      <div className="mx-auto mt-14 max-w-5xl px-2 sm:px-6">
        <MacBook abrir>
          <TelaVirtual>
            <TelaRadar ativa />
          </TelaVirtual>
        </MacBook>
      </div>
    </section>
  );
}

// ── Como funciona (rolagem com o MacBook fixo) ─────────────────────────

const PASSOS = [
  { titulo: "Mapeie a cidade", texto: "Escolha o nicho e desenhe a área no mapa. Em segundos, cada empresa aparece com a situação da presença digital dela.", Tela: TelaRadar },
  { titulo: "Veja quem vale a pena", texto: "Cada lead ganha uma nota de 0 a 100: sem site, só Instagram, só cardápio no iFood, avaliação boa e WhatsApp ativo sobem a nota.", Tela: TelaLeads },
  { titulo: "Aborde e feche", texto: "A IA escreve a primeira mensagem com o que foi encontrado. Você abre no WhatsApp, acompanha no CRM e registra a venda.", Tela: TelaCRM },
];

function ComoFunciona() {
  const caixa = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(0);
  const { scrollYProgress } = useScroll({ target: caixa, offset: ["start center", "end center"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setAtivo(Math.min(PASSOS.length - 1, Math.max(0, Math.floor(v * PASSOS.length)))));

  return (
    <section id="como-funciona" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Da cidade inteira à venda fechada, em três passos.</h2>

        {/* Desktop: passos à esquerda, MacBook fixo à direita */}
        <div ref={caixa} className="mt-14 hidden gap-10 lg:grid lg:grid-cols-[0.8fr_1.2fr]">
          <ol className="space-y-[38vh] pb-[30vh] pt-[12vh]">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className={cn("transition-opacity duration-500", ativo === i ? "opacity-100" : "opacity-35")}>
                <span className="font-display text-sm font-semibold text-[#ffb347]">Passo {i + 1}</span>
                <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{p.titulo}</h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
          <div className="relative">
            <div className="sticky top-[18vh]">
              <MacBook>
                {PASSOS.map(({ Tela, titulo }, i) => (
                  <motion.div key={titulo} className="absolute inset-0" animate={{ opacity: ativo === i ? 1 : 0, scale: ativo === i ? 1 : 0.985 }} transition={{ duration: 0.5 }} aria-hidden={ativo !== i}>
                    <TelaVirtual>
                      <Tela ativa={ativo === i} />
                    </TelaVirtual>
                  </motion.div>
                ))}
              </MacBook>
            </div>
          </div>
        </div>

        {/* Celular: um passo, um MacBook */}
        <ol className="mt-10 space-y-14 lg:hidden">
          {PASSOS.map(({ Tela, titulo, texto }, i) => (
            <li key={titulo}>
              <span className="font-display text-sm font-semibold text-[#ffb347]">Passo {i + 1}</span>
              <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{titulo}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{texto}</p>
              <PassoCelular Tela={Tela} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PassoCelular({ Tela }: { Tela: (p: { ativa: boolean }) => React.ReactNode }) {
  const [visto, setVisto] = useState(false);
  return (
    <motion.div className="mt-6" onViewportEnter={() => setVisto(true)} viewport={{ once: true, amount: 0.4 }}>
      <MacBook>
        <TelaVirtual>
          <Tela ativa={visto} />
        </TelaVirtual>
      </MacBook>
    </motion.div>
  );
}

// ── O que ele enxerga ──────────────────────────────────────────────────

const SINAIS = [
  { rotulo: "Sem site nenhum", exemplo: "Só o telefone no Google Maps", forte: true },
  { rotulo: "Só Instagram", exemplo: "O “site” é o perfil ou o link na bio" },
  { rotulo: "Só cardápio de app", exemplo: "iFood, Anota Aí, Brendi, Goomer…" },
  { rotulo: "Só agenda de app", exemplo: "AppBarber, Trinks, Booksy…" },
  { rotulo: "Domínio que só redireciona", exemplo: "O endereço próprio cai no cardápio do app" },
  { rotulo: "Site fraco", exemplo: "Lento, sem celular, sem HTTPS, sem WhatsApp" },
];

function OQueEnxerga() {
  return (
    <section id="o-que-enxerga" className="scroll-mt-20 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Ele entende o que é “ter site” de verdade.</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Uma hamburgueria com o link do iFood no Google parece ter site. Não tem. O Vynexa Leads abre cada endereço, percebe quando é só uma plataforma de terceiros e coloca essa empresa na frente da fila — com o motivo escrito, para você usar na conversa.
          </p>
          <Link href="/cadastro" className={cn(botaoBrasa, "mt-8")}>
            Ver na minha cidade <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SINAIS.map((s, i) => (
            <motion.li
              key={s.rotulo}
              className={cn("rounded-2xl border p-5", s.forte ? "border-[#ff5a1f]/50 bg-gradient-to-br from-[#ff5a1f]/20 to-transparent" : "border-white/[0.08] bg-white/[0.02]")}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
            >
              <p className="font-display text-lg font-semibold">{s.rotulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.exemplo}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Planos ─────────────────────────────────────────────────────────────

function Planos({ planos, diasTeste }: { planos: Plano[]; diasTeste: number }) {
  return (
    <section id="planos" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Um site vendido paga o ano inteiro.</h2>
          <p className="mt-4 text-base text-muted-foreground">
            {diasTeste > 0 ? `Todos os planos começam com ${diasTeste} dias grátis. ` : ""}Pix, boleto ou cartão, renovação mensal e cancelamento sem multa.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
          {planos.map((p, i) => (
            <motion.article
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-3xl border p-7",
                p.destaque ? "border-[#ff5a1f]/60 bg-gradient-to-b from-[#ff5a1f]/[0.16] to-[#ff5a1f]/[0.02] shadow-[0_30px_80px_-40px_rgba(255,90,31,0.9)] lg:-my-4 lg:py-11" : "border-white/[0.08] bg-white/[0.02]",
              )}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.1, duration: 0.55 }}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ff7a45] to-[#e8470f] px-3 py-1 text-xs font-bold text-sobre-brasa">
                  <Sparkles className="size-3.5" aria-hidden="true" /> Mais escolhido
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{p.nome}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.descricao}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="num font-display text-[2.6rem] font-semibold leading-none tracking-tight">{formatarPreco(p.precoCentavos)}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {COMPARATIVO.map((linha) => {
                  const v = linha.valor(p);
                  return (
                    <li key={linha.rotulo} className="flex items-start gap-2.5">
                      {v === false ? <X className="mt-0.5 size-4 shrink-0 text-white/25" aria-label="Não incluso" /> : <Check className="mt-0.5 size-4 shrink-0 text-[#ffb347]" aria-label="Incluso" />}
                      <span className={cn(v === false && "text-white/35")}>
                        {linha.rotulo}
                        {typeof v === "string" && <span className="text-muted-foreground"> · {v}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link href={`/cadastro?plano=${p.id}`} className={cn("mt-8 w-full", p.destaque ? botaoBrasa : botaoFio)}>
                Começar no {p.nome}
              </Link>
            </motion.article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">A busca no Google Maps (PRO e Agência) usa a sua chave do Google, que tem uma cota grátis todo mês. O passo a passo para criar está nos tutoriais.</p>
      </div>
    </section>
  );
}

// ── Perguntas ──────────────────────────────────────────────────────────

const PERGUNTAS = [
  { p: "Preciso saber programar?", r: "Não. Você escolhe o nicho, marca a área no mapa e o sistema faz o resto. Todo o caminho está explicado na aba Tutoriais." },
  { p: "De onde vêm as empresas?", r: "Do OpenStreetMap (em todos os planos) e do Google Maps pela API oficial (PRO e Agência, com a sua chave). Nada de robô raspando o Google ou o Instagram." },
  { p: "A mensagem vai sozinha para o WhatsApp do cliente?", r: "Não. A IA sugere o texto e você decide: um toque abre o WhatsApp com a mensagem pronta, e quem envia é você. Isso protege o seu número de bloqueio." },
  { p: "O que acontece se o teste acabar e eu não assinar?", r: "O acesso pausa, mas seus leads e o CRM ficam guardados. Assinou, voltou tudo como estava." },
  { p: "Posso trocar de plano ou cancelar?", r: "Quando quiser, pela tela Assinatura. Cancelando, você usa até o fim do período pago e não há multa." },
  { p: "Funciona fora de Manaus?", r: "Funciona em qualquer cidade do Brasil — e em outros países também." },
];

function Perguntas({ whatsapp }: { whatsapp: string | null }) {
  return (
    <section id="perguntas" className="scroll-mt-20 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Perguntas que chegam na live.</h2>
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className={cn(botaoFio, "mt-6")}>
              <MessageCircle className="size-4" aria-hidden="true" /> Falar no WhatsApp
            </a>
          )}
        </div>
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {PERGUNTAS.map((q) => (
            <details key={q.p} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {q.p}
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">{q.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final ──────────────────────────────────────────────────────────────

function Final({ diasTeste }: { diasTeste: number }) {
  return (
    <section className="px-4 pb-20 pt-6 sm:px-6">
      <div className="heroi relative mx-auto max-w-6xl overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
        <EsculturaV className="absolute -right-24 top-1/2 -z-10 h-[160%] -translate-y-1/2 opacity-70" />
        <h2 className="mx-auto max-w-3xl font-display text-3xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">A empresa que você vai atender amanhã já está no mapa.</h2>
        <Link href="/cadastro" className="mt-9 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-7 text-[0.95rem] font-bold text-[#7a1d04] transition-transform hover:-translate-y-0.5">
          {diasTeste > 0 ? `Começar meus ${diasTeste} dias grátis` : "Criar minha conta"} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Rodape({ whatsapp }: { whatsapp: string | null }) {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Marca />
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Rodapé">
          <Link href="/termos" className="hover:text-foreground">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Suporte
            </a>
          )}
        </nav>
        <p>© {new Date().getFullYear()} Vynexa</p>
      </div>
    </footer>
  );
}

export function Landing({ planos, diasTeste, whatsapp }: Props) {
  return (
    <div className="min-h-dvh bg-[#0b0a09] text-foreground">
      <Topo />
      <main>
        <Heroi diasTeste={diasTeste} />
        <ComoFunciona />
        <OQueEnxerga />
        <Planos planos={planos} diasTeste={diasTeste} />
        <Perguntas whatsapp={whatsapp} />
        <Final diasTeste={diasTeste} />
      </main>
      <Rodape whatsapp={whatsapp} />
    </div>
  );
}
