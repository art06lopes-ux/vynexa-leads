"use client";

import { motion } from "framer-motion";
import { AtSign, Globe, LoaderCircle, Mail, MessageCircle, Plus, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormProjeto } from "@/components/sites/form-projeto";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ClienteCarteira } from "@/db/carteira";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { ESTAGIOS_CARTEIRA, ROTULO_ESTAGIO, ROTULO_STATUS_PROJETO, type EstagioCarteira } from "@/lib/projetos";
import { cn } from "@/lib/utils";

/**
 * A mesa de relacionamento: quem respondeu, quem está negociando, quem
 * recebeu proposta e quem já é cliente — com o contato à mão, a entrega
 * digital de cada um e quanto já rendeu.
 */

export type ClienteTela = ClienteCarteira & { whats: string | null };

type Aba = "todos" | EstagioCarteira;

const COR_ESTAGIO: Record<EstagioCarteira, string> = {
  respondeu: "bg-white/10 text-foreground",
  negociacao: "bg-ciano/15 text-ciano",
  proposta: "bg-aviso/15 text-aviso",
  fechado: "bg-sucesso/15 text-sucesso",
};

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const campo = "h-10 w-full rounded-xl border border-fio bg-tinta/60 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brilho/60";

export function TelaClientes({ clientes }: { clientes: ClienteTela[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [aba, setAba] = useState<Aba>("todos");
  const [q, setQ] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [projetoPara, setProjetoPara] = useState<string | null>(null);
  const [mudando, setMudando] = useState<string | null>(null);

  // /clientes?novo=1 (atalho do Início e da paleta).
  useEffect(() => {
    if (params.get("novo") !== "1") return;
    const t = setTimeout(() => {
      setNovoAberto(true);
      router.replace("/clientes", { scroll: false });
    }, 0);
    return () => clearTimeout(t);
  }, [params, router]);

  const contagem = useMemo(() => {
    const c: Record<Aba, number> = { todos: clientes.length, respondeu: 0, negociacao: 0, proposta: 0, fechado: 0 };
    for (const x of clientes) c[x.etapa] += 1;
    return c;
  }, [clientes]);

  const termo = q.trim().toLowerCase();
  const visiveis = clientes.filter((c) => (aba === "todos" || c.etapa === aba) && (!termo || `${c.nome} ${c.categoria} ${c.cidade ?? ""}`.toLowerCase().includes(termo)));

  async function mudarEstagio(c: ClienteTela, etapa: string) {
    setMudando(c.lead_id);
    try {
      const r = await fetch(`/api/leads/${c.lead_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "etapa", etapa }) });
      if (!r.ok) throw new Error();
      toast.success(etapa === "perdido" ? `${c.nome} saiu da carteira (perdido).` : `${c.nome} agora está em ${ROTULO_ESTAGIO[etapa as EstagioCarteira]}.`);
      router.refresh();
    } catch {
      toast.error("Não foi possível mudar o estágio.");
    } finally {
      setMudando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="placa min-w-0 p-0 xl:col-span-8" aria-labelledby="titulo-carteira-clientes">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <h2 id="titulo-carteira-clientes" className="text-lg font-semibold">
                Sua carteira
              </h2>
              <p className="text-xs text-muted-foreground">Quem respondeu entra aqui sozinho. Mude o estágio direto na linha.</p>
            </div>
            <div className="flex gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar" aria-label="Procurar na carteira" className="h-10 w-40 rounded-xl border border-fio bg-tinta/60 pl-9 pr-3 text-sm outline-none focus:border-brilho/60 sm:w-52" />
              </label>
              <button type="button" onClick={() => setNovoAberto(true)} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-sobre-brasa hover:bg-brilho">
                <UserPlus className="size-4" /> <span className="hidden sm:inline">Novo cliente</span>
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-y border-fio px-3 py-2" role="tablist" aria-label="Estágio">
            {(["todos", ...ESTAGIOS_CARTEIRA] as Aba[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={aba === v}
                onClick={() => setAba(v)}
                className={cn("relative h-9 shrink-0 cursor-pointer rounded-xl px-3 text-sm font-semibold transition-colors", aba === v ? "text-sobre-brasa" : "text-muted-foreground hover:text-foreground")}
              >
                {aba === v && <motion.span layoutId="aba-clientes" className="absolute inset-0 rounded-xl bg-azul" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">
                  {v === "todos" ? "Todos" : ROTULO_ESTAGIO[v]} <span className="num opacity-70">{contagem[v]}</span>
                </span>
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-semibold">{clientes.length === 0 ? "Sua carteira está vazia" : "Ninguém neste estágio"}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {clientes.length === 0 ? "Quando um lead responder a uma abordagem, ele aparece aqui. Ou cadastre um cliente que veio por indicação." : "Troque a aba ou limpe a busca."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Empresa</th>
                    <th className="px-3 py-3 font-semibold">Contato</th>
                    <th className="px-3 py-3 font-semibold">Estágio</th>
                    <th className="px-3 py-3 font-semibold">Entrega digital</th>
                    <th className="px-5 py-3 text-right font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fio">
                  {visiveis.map((c) => (
                    <tr key={c.lead_id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="max-w-[16rem] px-5 py-3">
                        <Link href={`/leads/${c.lead_id}`} className="block truncate font-semibold hover:text-brilho">
                          {c.nome}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.categoria}
                          {c.cidade ? ` · ${c.cidade}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex gap-1">
                          {c.whats && (
                            <a href={`https://wa.me/${c.whats}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${c.nome}`} className="flex size-8 items-center justify-center rounded-lg border border-fio text-sucesso hover:bg-white/5">
                              <MessageCircle className="size-4" />
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} aria-label={`E-mail de ${c.nome}`} className="flex size-8 items-center justify-center rounded-lg border border-fio text-ciano hover:bg-white/5">
                              <Mail className="size-4" />
                            </a>
                          )}
                          {c.instagram && (
                            <a href={c.instagram.startsWith("http") ? c.instagram : `https://instagram.com/${c.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" aria-label={`Instagram de ${c.nome}`} className="flex size-8 items-center justify-center rounded-lg border border-fio text-brilho hover:bg-white/5">
                              <AtSign className="size-4" />
                            </a>
                          )}
                          {!c.whats && !c.email && !c.instagram && <span className="text-xs text-muted-foreground">Sem contato</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="relative inline-flex items-center">
                          <select
                            value={c.etapa}
                            disabled={mudando === c.lead_id}
                            onChange={(e) => void mudarEstagio(c, e.target.value)}
                            aria-label={`Estágio de ${c.nome}`}
                            className={cn("h-8 cursor-pointer appearance-none rounded-full border-0 py-0 pl-3 pr-7 text-xs font-semibold outline-none", COR_ESTAGIO[c.etapa])}
                          >
                            {ESTAGIOS_CARTEIRA.map((s) => (
                              <option key={s} value={s} className="bg-popover text-foreground">
                                {ROTULO_ESTAGIO[s]}
                              </option>
                            ))}
                            <option value="perdido" className="bg-popover text-foreground">
                              Perdido (tirar da carteira)
                            </option>
                          </select>
                          {mudando === c.lead_id ? <LoaderCircle className="pointer-events-none absolute right-2 size-3.5 animate-spin" /> : <span className="pointer-events-none absolute right-2.5 text-[0.6rem] opacity-70">▼</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {c.projeto_status ? (
                          <Link href="/sites" className="inline-flex items-center gap-1.5 text-xs font-semibold hover:text-brilho">
                            <Globe className="size-3.5 text-ciano" /> {ROTULO_STATUS_PROJETO[c.projeto_status]}
                          </Link>
                        ) : (
                          <button type="button" onClick={() => setProjetoPara(c.lead_id)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-brilho">
                            <Plus className="size-3.5" /> Criar projeto
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.receita > 0 ? <span className="valor-sensivel font-semibold num">{formatarDinheiro(c.receita)}</span> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Pulso contagem={contagem} />
      </div>

      <NovoCliente aberto={novoAberto} aoFechar={() => setNovoAberto(false)} />
      <FormProjeto aberto={projetoPara !== null} aoFechar={() => setProjetoPara(null)} projeto={null} clientes={clientes.map((c) => ({ id: c.lead_id, nome: c.nome }))} leadInicial={projetoPara} />
    </div>
  );
}

/** Funil da carteira: quantos em cada estágio e quanto passa de um para o próximo. */
function Pulso({ contagem }: { contagem: Record<Aba, number> }) {
  // Cada estágio conta também quem já passou dele (quem fechou já negociou).
  const acumulado = ESTAGIOS_CARTEIRA.map((_, i) => ESTAGIOS_CARTEIRA.slice(i).reduce((s, e) => s + contagem[e], 0));
  const topo = Math.max(acumulado[0], 1);
  return (
    <section className="placa p-5 xl:col-span-4" aria-labelledby="titulo-pulso">
      <h2 id="titulo-pulso" className="text-lg font-semibold">
        Pulso da carteira
      </h2>
      <p className="text-xs text-muted-foreground">Quantos chegaram a cada estágio e quanto avança para o próximo.</p>
      <ol className="mt-5 space-y-4">
        {ESTAGIOS_CARTEIRA.map((e, i) => {
          const passagem = i > 0 && acumulado[i - 1] > 0 ? Math.round((acumulado[i] / acumulado[i - 1]) * 100) : null;
          return (
            <li key={e}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{ROTULO_ESTAGIO[e]}</span>
                <span className="text-xs text-muted-foreground num">
                  <b className="text-base text-foreground">{acumulado[i]}</b>
                  {passagem !== null && ` · ${passagem}% avançam`}
                </span>
              </div>
              <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-white/6">
                <motion.span
                  className="block h-full rounded-full bg-gradient-to-r from-azul to-ciano"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(acumulado[i] / topo) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 rounded-xl border border-fio bg-tinta/50 p-3 text-xs text-muted-foreground">
        Hoje <b className="text-foreground">{contagem.fechado}</b> {contagem.fechado === 1 ? "cliente fechado" : "clientes fechados"} de <b className="text-foreground">{acumulado[0]}</b> que responderam.
      </p>
    </section>
  );
}

function NovoCliente({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(f: FormData) {
    setSalvando(true);
    setErro(null);
    const g = (k: string) => String(f.get(k) ?? "").trim();
    try {
      const r = await fetch("/api/leads/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "manual", nome: g("nome"), categoria: g("categoria"), pais: "BR", estado: g("estado") || undefined, cidade: g("cidade") || undefined, telefone: g("telefone") || undefined, email: g("email") || undefined, instagram: g("instagram") || undefined }),
      });
      const d = (await r.json()) as { leadId?: string | null; erro?: string; campos?: Array<{ mensagem: string }> };
      if (!r.ok || !d.leadId) {
        setErro(d.campos?.[0]?.mensagem ?? d.erro ?? "Não foi possível cadastrar. Talvez essa empresa já esteja na carteira.");
        return;
      }
      await fetch(`/api/leads/${d.leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "etapa", etapa: g("etapa") || "negociacao" }) });
      toast.success(`${g("nome")} entrou na carteira.`);
      aoFechar();
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border border-fio bg-placa p-5 sm:max-w-lg">
        <DialogTitle className="text-lg font-semibold">Novo cliente</DialogTitle>
        <DialogDescription className="-mt-2 text-sm text-muted-foreground">Para quem chegou por indicação, Instagram ou boca a boca — sem passar pelo Radar.</DialogDescription>
        <form action={(f) => void salvar(f)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Empresa ou nome</span>
            <input name="nome" required minLength={2} className={campo} placeholder="Barbearia do João" autoFocus />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Segmento</span>
            <input name="categoria" required minLength={2} className={campo} placeholder="Barbearia" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Estágio</span>
            <select name="etapa" defaultValue="negociacao" className={cn(campo, "cursor-pointer")}>
              {ESTAGIOS_CARTEIRA.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_ESTAGIO[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Cidade</span>
            <input name="cidade" className={campo} placeholder="Manacapuru" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Estado</span>
            <select name="estado" defaultValue="AM" className={cn(campo, "cursor-pointer")}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">WhatsApp / telefone</span>
            <input name="telefone" inputMode="tel" className={campo} placeholder="(92) 99999-9999" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">E-mail</span>
            <input name="email" type="email" className={campo} placeholder="contato@empresa.com" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Instagram</span>
            <input name="instagram" className={campo} placeholder="@empresa" />
          </label>
          {erro && (
            <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo sm:col-span-2">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={aoFechar} className="h-10 cursor-pointer rounded-xl border border-fio px-4 text-sm hover:bg-white/5">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-azul px-5 text-sm font-semibold text-sobre-brasa hover:bg-brilho disabled:opacity-60">
              {salvando && <LoaderCircle className="size-4 animate-spin" />} Cadastrar cliente
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
