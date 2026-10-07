"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Resposta = { concluido?: boolean; apagadas?: number; restantes?: number; erro?: string };

/**
 * Apaga a carteira inteira para começar do zero. Exige digitar ZERAR —
 * não há desfazer — e repete a chamada até o servidor dizer que acabou,
 * mostrando quanto falta.
 */
export function ZerarDados({ leads, vendas }: { leads: number; vendas: number }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [incluirVendas, setIncluirVendas] = useState(true);
  const [andamento, setAndamento] = useState<string | null>(null);

  async function zerar() {
    let apagadas = 0;
    setAndamento("Apagando…");
    try {
      for (let rodada = 0; rodada < 40; rodada += 1) {
        const r = await fetch("/api/zerar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmacao: texto.trim(), incluirVendas }),
        });
        const d = (await r.json().catch(() => ({}))) as Resposta;
        if (!r.ok) {
          toast.error(d.erro ?? "Não conseguimos terminar a limpeza.", { duration: 15_000 });
          return;
        }
        apagadas += d.apagadas ?? 0;
        if (d.concluido) {
          toast.success("Pronto: carteira zerada. Configurações, chaves e produtos foram mantidos.");
          setTexto("");
          router.refresh();
          return;
        }
        setAndamento(`Apagando… ${apagadas.toLocaleString("pt-BR")} registros removidos, ${(d.restantes ?? 0).toLocaleString("pt-BR")} restantes`);
      }
      toast.error("A limpeza está demorando mais que o normal. Toque em Zerar de novo para continuar de onde parou.");
    } catch {
      toast.error("Falha de rede. Toque em Zerar de novo: a limpeza continua de onde parou.");
    } finally {
      setAndamento(null);
      router.refresh();
    }
  }

  const vazio = leads === 0 && (vendas === 0 || !incluirVendas);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Apaga <strong className="text-foreground">{leads.toLocaleString("pt-BR")} leads</strong> com tudo que depende deles: buscas, histórico,
        mensagens, propostas, campanhas, e-mails enviados e notificações. Mantém sua identidade, logo, chaves de API, produtos, os aparelhos com
        aviso ligado e a lista de “não contatar”. Não dá para desfazer.
      </p>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={incluirVendas} onChange={(e) => setIncluirVendas(e.target.checked)} className="size-4 accent-[#ff5d6c]" />
        Apagar também as vendas e cobranças ({vendas.toLocaleString("pt-BR")})
      </label>
      <label className="block space-y-1.5">
        <span className="rotulo">Digite ZERAR para confirmar</span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value.toUpperCase())}
          autoComplete="off"
          className="h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-perigo/60"
        />
      </label>
      <button
        type="button"
        onClick={zerar}
        disabled={texto.trim() !== "ZERAR" || andamento !== null || vazio}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-perigo px-4 text-sm font-semibold text-white hover:bg-perigo/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {andamento ? <LoaderCircle className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
        {andamento ?? (vazio ? "Nada para apagar" : "Zerar e começar do zero")}
      </button>
    </div>
  );
}
