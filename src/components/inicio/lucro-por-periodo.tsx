"use client";

import { useMemo, useState } from "react";

import { GraficoBarras } from "@/components/graficos/graficos";
import { Contador } from "@/components/motion/contador";
import type { VendaPaga } from "@/db/painel";
import { agrupar } from "@/lib/periodos";

import { Variacao } from "./painel-lucro";

/** Receita × lucro, mês a mês — para ver se a margem acompanha o faturamento. */
export function LucroPorPeriodo({ vendas }: { vendas: VendaPaga[] }) {
  const [periodo, setPeriodo] = useState<"6m" | "1a">("6m");
  const g = useMemo(() => agrupar(vendas, periodo), [vendas, periodo]);
  return (
    <section className="placa flex h-full flex-col p-5" aria-labelledby="titulo-lucro-periodo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-lucro-periodo" className="font-semibold">
            Lucro por período
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <Contador valor={g.lucro} formato="moeda" className="font-display text-2xl font-semibold" />
            <Variacao valor={g.variacaoLucro} />
          </div>
        </div>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as "6m" | "1a")} aria-label="Período do gráfico" className="h-9 cursor-pointer rounded-xl border border-fio bg-placa px-3 text-xs">
          <option value="6m">6 meses</option>
          <option value="1a">1 ano</option>
        </select>
      </div>
      <div className="mt-3 flex-1">
        <GraficoBarras
          dados={g.pontos.map((p) => ({ rotulo: p.rotulo, valores: { receita: p.receita, lucro: p.lucro } }))}
          series={[
            { chave: "receita", rotulo: "Receita", cor: "#ffb347" },
            { chave: "lucro", rotulo: "Lucro", cor: "#ff5a1f" },
          ]}
          formato="moeda"
          altura={170}
          titulo="Receita e lucro por mês"
        />
      </div>
    </section>
  );
}
