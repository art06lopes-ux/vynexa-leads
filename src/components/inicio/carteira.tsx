import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";

import { Contador } from "@/components/motion/contador";
import type { VendaPaga } from "@/db/painel";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { haQuantoTempo } from "@/services/crm";

import { Variacao } from "./painel-lucro";

/**
 * "Minha carteira": o lucro disponível do mês num cartão com o V da
 * Vynexa, os dois atalhos que mais se usa (novo cliente, nova venda) e
 * as últimas vendas pagas.
 */
export function Carteira({ vendas, lucroMes, receitaMes, variacao }: { vendas: VendaPaga[]; lucroMes: number; receitaMes: number; variacao: number | null }) {
  const recentes = vendas.slice(0, 5);
  return (
    <section className="heroi flex h-full flex-col p-5 sm:p-6" aria-labelledby="titulo-carteira">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-carteira" className="text-lg font-semibold text-white">
          Minha carteira
        </h2>
        <Link href="/pagamentos?nova=1" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-black/20 px-3.5 text-sm font-semibold text-white hover:bg-black/30">
          <Plus className="size-4" /> Nova venda
        </Link>
      </div>

      {/* O cartão: duas lâminas atrás dão a sensação de carteira. */}
      <div className="relative mt-5">
        <div className="absolute inset-x-6 -top-3 h-10 rounded-2xl bg-black/30" aria-hidden="true" />
        <div className="absolute inset-x-3 -top-1.5 h-10 rounded-2xl bg-black/40" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f1813] via-[#140f0c] to-[#0b0908] p-5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)]">
          <div aria-hidden="true" className="absolute -right-10 -top-16 size-48 rounded-full bg-[#ff5a1f]/25 blur-3xl" />
          <div className="relative flex items-start justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG pequeno da marca */}
            <img src="/marca/v-brasa-96.png" alt="" width={34} height={34} className="size-9 object-contain" />
            <span aria-hidden="true" className="h-7 w-10 rounded-md bg-gradient-to-br from-[#f1e3cf] via-[#cdb796] to-[#9d8461] opacity-90" />
          </div>
          <p className="relative mt-6 text-xs text-white/60">Lucro disponível · este mês</p>
          <div className="relative mt-1 flex items-center gap-2.5">
            <Contador valor={lucroMes} formato="moeda" className="font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white" />
            <Variacao valor={variacao} />
          </div>
          <p className="relative mt-2 text-xs text-white/55">
            Receita <span className="valor-sensivel num">{formatarDinheiro(receitaMes)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/clientes?novo=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black/25 text-sm font-semibold text-white hover:bg-black/35">
          <ArrowDownLeft className="size-4" /> Cliente
        </Link>
        <Link href="/pagamentos?nova=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#fff4ea] text-sm font-semibold text-sobre-brasa hover:bg-white">
          <ArrowUpRight className="size-4" /> Venda
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-semibold text-white">Vendas recentes</h3>
        <Link href="/pagamentos" className="text-sm text-white/80 hover:text-white">
          Ver todas
        </Link>
      </div>
      {recentes.length === 0 ? (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">Nenhuma venda registrada</p>
          <p className="mt-1 text-xs text-white/70">Suas vendas pagas aparecem aqui.</p>
          <Link href="/pagamentos?nova=1" className="mt-4 rounded-full bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-black/40">
            Registrar primeira venda
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {recentes.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#fff4ea] text-sobre-brasa">
                <ArrowUpRight className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{v.cliente ?? v.descricao}</span>
                <span className="block truncate text-[0.7rem] text-white/65">
                  {v.descricao} · {haQuantoTempo(v.pagoEm)}
                </span>
              </span>
              <span className="valor-sensivel shrink-0 text-sm font-semibold text-white num">{formatarDinheiro(v.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
