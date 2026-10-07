"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ItemNotificacao, useNotificacoes } from "./notificacoes";

const FILTROS = [
  { chave: "", rotulo: "Todas" },
  { chave: "venda", rotulo: "Vendas" },
  { chave: "pagamento", rotulo: "Pagamentos" },
  { chave: "resposta", rotulo: "Respostas" },
  { chave: "campanha", rotulo: "Campanhas" },
  { chave: "oportunidade", rotulo: "Oportunidades" },
];

/** A central completa: as mesmas notificações do sino, com filtro. */
export function ListaNotificacoes() {
  const { itens, naoLidas, marcarLidas } = useNotificacoes();
  const [filtro, setFiltro] = useState("");
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const visiveis = itens.filter(
    (n) =>
      (!filtro || n.tipo === filtro || (filtro === "campanha" && ["campanha_concluida", "erro_campanha", "email_enviado"].includes(n.tipo)) || (filtro === "oportunidade" && n.tipo === "busca_concluida")) &&
      (!soNaoLidas || !n.lida_em),
  );

  return (
    <div className="placa">
      <div className="flex flex-wrap items-center gap-2 border-b border-fio px-4 py-3">
        {FILTROS.map((f) => (
          <button key={f.chave} type="button" onClick={() => setFiltro(f.chave)} className={cn("h-8 cursor-pointer rounded-lg px-3 text-sm", filtro === f.chave ? "bg-azul/20 text-ciano" : "text-muted-foreground hover:bg-white/5")}>
            {f.rotulo}
          </button>
        ))}
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={soNaoLidas} onChange={(e) => setSoNaoLidas(e.target.checked)} className="accent-[#3366ff]" /> Só não lidas
        </label>
        {naoLidas > 0 && (
          <button type="button" onClick={() => marcarLidas()} className="ml-auto flex cursor-pointer items-center gap-1 text-sm font-medium text-ciano hover:underline">
            <CheckCheck className="size-4" /> Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        {visiveis.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">Nada por aqui. Vendas, respostas e campanhas aparecem assim que acontecem.</p>
        ) : (
          visiveis.map((n) => <ItemNotificacao key={n.id} n={n} aoClicar={() => !n.lida_em && void marcarLidas([n.id])} />)
        )}
      </div>
    </div>
  );
}
