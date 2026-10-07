"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, LoaderCircle, Mail, MessageCircle, Pencil, Send, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { IconeInstagram } from "@/components/leads/cartao-lead";
import type { MensagemLead } from "@/db/leads";
import { cn } from "@/lib/utils";

import { acaoLead } from "./acao";

/**
 * Estúdio de abordagem: as versões que a IA escreveu, editáveis, com
 * "Copiar", "Abrir WhatsApp" e o preview do e-mail antes de enviar.
 *
 * O WhatsApp NUNCA é enviado pelo sistema: o link abre a conversa com o
 * texto pronto, e quem aperta "enviar" é o operador, no próprio app.
 */

const ABAS = [
  { tipo: "whatsapp", rotulo: "WhatsApp" },
  { tipo: "curta", rotulo: "Curta" },
  { tipo: "profissional", rotulo: "Profissional" },
  { tipo: "informal", rotulo: "Informal" },
  { tipo: "instagram", rotulo: "Instagram DM" },
  { tipo: "email", rotulo: "E-mail" },
] as const;

type Props = {
  leadId: string;
  mensagens: MensagemLead[];
  whatsappNumero: string | null;
  email: string | null;
  instagramUrl: string | null;
  naoContatar: boolean;
  remetente: string;
  assinatura: string;
  provedorEmailPronto: boolean;
  iaConfigurada: boolean;
};

export function EstudioAbordagem(p: Props) {
  const router = useRouter();
  const ultimas = useMemo(() => {
    const m = new Map<string, MensagemLead>();
    for (const msg of p.mensagens) if (!m.has(msg.tipo)) m.set(msg.tipo, msg);
    return m;
  }, [p.mensagens]);

  const [aba, setAba] = useState<string>(p.whatsappNumero ? "whatsapp" : "email");
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries([...ultimas].map(([k, v]) => [k, v.corpo])));
  const [assunto, setAssunto] = useState(ultimas.get("email")?.assunto ?? "");
  const [para, setPara] = useState(p.email ?? "");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const texto = textos[aba] ?? "";
  const temAlguma = ultimas.size > 0;

  async function gerar() {
    setGerando(true);
    const d = await acaoLead<{ versoes: Record<string, string>; email: { assunto: string; corpo: string } | null }>(p.leadId, { acao: "abordagem" });
    setGerando(false);
    if (!d) return;
    setTextos({ ...d.versoes, ...(d.email ? { email: d.email.corpo } : {}) });
    if (d.email) setAssunto(d.email.assunto);
    toast.success("Abordagens geradas para este lead.");
    router.refresh();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(aba === "email" ? `${assunto}\n\n${texto}` : texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
      void acaoLead(p.leadId, { acao: "contato", tipo: "mensagem_copiada", detalhe: ABAS.find((a) => a.tipo === aba)?.rotulo });
    } catch {
      toast.error("O navegador bloqueou a cópia. Selecione o texto e copie à mão.");
    }
  }

  function abrirWhatsapp() {
    if (!p.whatsappNumero) return;
    window.open(`https://wa.me/${p.whatsappNumero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    void acaoLead(p.leadId, { acao: "contato", tipo: "whatsapp_aberto" }).then(() => router.refresh());
  }

  async function enviarEmail() {
    setEnviando(true);
    const d = await acaoLead(p.leadId, { acao: "email", assunto, corpo: texto, para: para || undefined });
    setEnviando(false);
    if (!d) return;
    setRevisando(false);
    toast.success(`E-mail enviado para ${para}.`);
    router.refresh();
  }

  return (
    <section className="placa overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <span className="pastilha size-8">
          <Wand2 className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[0.95rem] font-semibold">Abordagem</h2>
          <p className="text-xs text-muted-foreground">Escrita para esta empresa, com os dados encontrados. Revise antes de mandar.</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={gerar}
          disabled={gerando || !p.iaConfigurada}
          title={p.iaConfigurada ? undefined : "Configure a IA em Configurações → Integrações"}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gerando ? <LoaderCircle className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {temAlguma ? "Gerar de novo" : "Gerar abordagem"}
        </motion.button>
      </header>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-fio px-5" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.tipo}
            role="tab"
            type="button"
            aria-selected={aba === a.tipo}
            onClick={() => {
              setAba(a.tipo);
              setRevisando(false);
            }}
            className={cn("relative h-10 shrink-0 cursor-pointer px-3 text-sm font-medium transition-colors", aba === a.tipo ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {a.rotulo}
            {aba === a.tipo && <motion.span layoutId="aba-abordagem" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ciano" />}
          </button>
        ))}
      </div>

      <div className="p-5">
        {gerando ? (
          <div className="space-y-2.5" aria-live="polite">
            <p className="text-sm text-muted-foreground">Escrevendo com base no que encontramos sobre a empresa…</p>
            {[90, 75, 82, 40].map((w, i) => (
              <span key={i} className="esqueleto block h-3.5" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : !texto && !p.iaConfigurada ? (
          <div className="rounded-xl border border-aviso/30 bg-aviso/[0.07] p-4 text-sm">
            <p className="font-semibold text-aviso">A IA não está configurada</p>
            <p className="mt-1 text-muted-foreground">Cole a chave gratuita do Gemini em Configurações → Integrações para gerar mensagens. Enquanto isso, você pode escrever a sua aqui.</p>
          </div>
        ) : null}

        {!gerando && (
          <AnimatePresence mode="wait">
            <motion.div key={aba} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-3">
              {aba === "email" && revisando ? (
                <div className="overflow-hidden rounded-xl border border-fio bg-[#f8fafc] text-[#111827]">
                  <div className="space-y-1 border-b border-[#e5e7eb] px-4 py-3 text-sm">
                    <p>
                      <span className="inline-block w-16 text-xs font-semibold uppercase text-[#6b7280]">Para</span> {para || "—"}
                    </p>
                    <p>
                      <span className="inline-block w-16 text-xs font-semibold uppercase text-[#6b7280]">Assunto</span> <b>{assunto}</b>
                    </p>
                  </div>
                  <div className="whitespace-pre-wrap px-4 py-4 text-[0.92rem] leading-relaxed">{texto}</div>
                  <div className="border-t-2 border-[#3366ff] mx-4 pb-4 pt-3 text-xs whitespace-pre-wrap text-[#374151]">{p.assinatura}</div>
                  <p className="px-4 pb-3 text-[0.7rem] text-[#9ca3af]">Rodapé automático: link para não receber mais mensagens.</p>
                </div>
              ) : (
                <>
                  {aba === "email" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="rotulo">Para</span>
                        <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="contato@empresa.com" className="h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60" />
                      </label>
                      <label className="space-y-1">
                        <span className="rotulo">Assunto</span>
                        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Uma ideia para…" className="h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60" />
                      </label>
                    </div>
                  )}
                  <textarea
                    value={texto}
                    onChange={(e) => setTextos((t) => ({ ...t, [aba]: e.target.value }))}
                    rows={aba === "email" || aba === "profissional" ? 9 : 5}
                    placeholder="A mensagem aparece aqui. Você pode editar à vontade."
                    aria-label={`Mensagem (${aba})`}
                    className="w-full resize-y rounded-xl border border-fio bg-white/[0.03] p-3.5 text-[0.92rem] leading-relaxed outline-none focus:border-brilho/60"
                  />
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={copiar} disabled={!texto} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio px-3 text-sm hover:bg-white/5 disabled:opacity-50">
                  {copiado ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />} {copiado ? "Copiado" : "Copiar mensagem"}
                </button>
                {aba !== "email" && aba !== "instagram" && (
                  <button
                    type="button"
                    onClick={abrirWhatsapp}
                    disabled={!p.whatsappNumero || !texto || p.naoContatar}
                    title={!p.whatsappNumero ? "Sem número de WhatsApp para esta empresa" : undefined}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1fa855] px-3 text-sm font-semibold text-white hover:bg-[#25c062] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MessageCircle className="size-4" /> Abrir WhatsApp
                  </button>
                )}
                {aba === "instagram" && p.instagramUrl && (
                  <a href={p.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-fio px-3 text-sm hover:bg-white/5">
                    <IconeInstagram className="size-4" /> Abrir Instagram
                  </a>
                )}
                {aba === "email" &&
                  (revisando ? (
                    <>
                      <button type="button" onClick={() => setRevisando(false)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-fio px-3 text-sm hover:bg-white/5">
                        <Pencil className="size-4" /> Editar
                      </button>
                      <button type="button" onClick={enviarEmail} disabled={enviando} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60">
                        {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRevisando(true)}
                      disabled={!texto || !assunto || !para || p.naoContatar || !p.provedorEmailPronto}
                      title={!p.provedorEmailPronto ? "Configure um provedor de e-mail em Configurações" : undefined}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-azul px-3 text-sm font-semibold text-white hover:bg-brilho disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Mail className="size-4" /> Revisar e enviar
                    </button>
                  ))}
                {p.naoContatar && <span className="text-xs font-semibold text-perigo">Esta empresa pediu para não ser contatada.</span>}
                {aba === "email" && !p.provedorEmailPronto && <span className="text-xs text-aviso">Nenhum provedor de e-mail pronto — veja Configurações → E-mail.</span>}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
