"use client";

import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECURSOS_DO_PLANO, type Plano } from "@/lib/planos";

const NOMES_RECURSO: Record<string, string> = {
  radar_google: "Google Maps",
  ia: "IA",
  ao_vivo: "Ao vivo",
  campanhas: "Campanhas de e-mail",
  prompts: "Prompts",
  clientes: "Clientes",
  sites: "Sites",
  vendas: "Vendas",
  exportar: "Exportar",
};

function paraReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
function deReais(v: string): number {
  return Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);
}
function limite(v: string): number | null {
  return v.trim() === "" ? null : Math.max(0, Math.round(Number(v)));
}

function CartaoPlano({ plano }: { plano: Plano }) {
  const router = useRouter();
  const [nome, setNome] = useState(plano.nome);
  const [descricao, setDescricao] = useState(plano.descricao);
  const [preco, setPreco] = useState(paraReais(plano.precoCentavos));
  const [destaque, setDestaque] = useState(plano.destaque);
  const [leads, setLeads] = useState(plano.limites.leads_mes?.toString() ?? "");
  const [usuarios, setUsuarios] = useState(plano.limites.usuarios?.toString() ?? "");
  const [ia, setIa] = useState(plano.limites.ia_mes?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/planos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plano.id, nome, descricao, precoCentavos: deReais(preco), destaque, limites: { leads_mes: limite(leads), usuarios: limite(usuarios), ia_mes: limite(ia) } }),
      });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; campos?: Array<{ mensagem: string }> };
      if (!r.ok) throw new Error(d.campos?.[0]?.mensagem ?? d.erro ?? "Falhou.");
      toast.success(`Plano ${nome} salvo.`);
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setSalvando(false);
    }
  }

  const id = (c: string) => `plano-${plano.id}-${c}`;
  return (
    <section className="placa flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">{plano.nome}</h2>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} className="accent-[#ff5a1f]" />
          <Sparkles className="size-3.5" aria-hidden="true" /> Mais escolhido
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={id("nome")}>Nome</Label>
          <Input id={id("nome")} value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5 h-10" />
        </div>
        <div>
          <Label htmlFor={id("preco")}>Preço por mês (R$)</Label>
          <Input id={id("preco")} inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} className="num mt-1.5 h-10" />
        </div>
      </div>
      <div>
        <Label htmlFor={id("desc")}>Frase do plano</Label>
        <Input id={id("desc")} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1.5 h-10" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={id("leads")}>Leads/mês</Label>
          <Input id={id("leads")} inputMode="numeric" value={leads} onChange={(e) => setLeads(e.target.value)} placeholder="sem limite" className="num mt-1.5 h-10" />
        </div>
        <div>
          <Label htmlFor={id("usuarios")}>Pessoas</Label>
          <Input id={id("usuarios")} inputMode="numeric" value={usuarios} onChange={(e) => setUsuarios(e.target.value)} placeholder="sem limite" className="num mt-1.5 h-10" />
        </div>
        <div>
          <Label htmlFor={id("ia")}>IA/mês</Label>
          <Input id={id("ia")} inputMode="numeric" value={ia} onChange={(e) => setIa(e.target.value)} placeholder="sem limite" className="num mt-1.5 h-10" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Libera: {RECURSOS_DO_PLANO[plano.id].length === 0 ? "Radar (OpenStreetMap), Leads e CRM" : `o básico + ${RECURSOS_DO_PLANO[plano.id].map((r) => NOMES_RECURSO[r] ?? r).join(", ")}`}. Campo vazio = sem limite.
      </p>
      <Button type="button" onClick={salvar} disabled={salvando} className="mt-auto cursor-pointer">
        {salvando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />} Salvar {nome}
      </Button>
    </section>
  );
}

export function EditorPlanos({ planos, config, cobrancaPronta }: { planos: Plano[]; config: { testeDias: number; whatsappSuporte: string }; cobrancaPronta: boolean }) {
  const router = useRouter();
  const [teste, setTeste] = useState(String(config.testeDias));
  const [whats, setWhats] = useState(config.whatsappSuporte);
  const [salvando, setSalvando] = useState(false);

  async function salvarConfig() {
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testeDias: Number(teste) || 0, whatsappSuporte: whats }) });
      const d = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Falhou.");
      toast.success("Configuração salva.");
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falhou.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      {!cobrancaPronta && (
        <div className="flex items-start gap-3 rounded-2xl border border-aviso/30 bg-aviso/[0.07] p-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-aviso" aria-hidden="true" />
          <p>
            A cobrança ainda não está ligada: cole a chave do Asaas em{" "}
            <Link href="/configuracoes?aba=integracoes" className="font-semibold underline underline-offset-2">
              Configurações → Integrações
            </Link>{" "}
            e cadastre o webhook no Asaas (passo a passo em Tutoriais → “Ligar a cobrança”). Até lá, os clientes ficam no teste e você libera na mão.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {planos.map((p) => (
          <CartaoPlano key={p.id} plano={p} />
        ))}
      </div>
      <section className="placa grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="cfg-teste">Dias de teste grátis no cadastro</Label>
          <Input id="cfg-teste" inputMode="numeric" value={teste} onChange={(e) => setTeste(e.target.value)} className="num mt-1.5 h-10" />
        </div>
        <div>
          <Label htmlFor="cfg-whats">WhatsApp do suporte (aparece no site e nos tutoriais)</Label>
          <Input id="cfg-whats" inputMode="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="5592999999999" className="num mt-1.5 h-10" />
        </div>
        <Button type="button" onClick={salvarConfig} disabled={salvando} className="cursor-pointer">
          {salvando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />} Salvar
        </Button>
      </section>
    </div>
  );
}
