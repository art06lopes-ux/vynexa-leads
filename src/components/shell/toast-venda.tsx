"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PartyPopper, X } from "lucide-react";
import { useEffect } from "react";

import { Marca } from "@/components/marca";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

/**
 * O aviso de venda. É o momento que o produto existe para criar, então
 * ganha tratamento próprio: entra com mola pelo canto, com a marca da
 * Vynexa, os dados da venda e uma barra que esvazia até sumir sozinho.
 */

export type DadosVendaToast = {
  vendaId: string;
  cliente: string | null;
  empresa: string | null;
  servico: string;
  valorCentavos: number;
  moeda: string;
  meio: string | null;
  data: string;
};

const DURACAO_MS = 10_000;

const ROTULO_MEIO: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  cartao_stripe: "Cartão",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

function formatarData(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

export function ToastVenda({ venda, aoFechar, logoUrl, empresa }: { venda: DadosVendaToast | null; aoFechar: () => void; logoUrl: string | null; empresa: string }) {
  const reduzir = useReducedMotion();

  useEffect(() => {
    if (!venda) return;
    const id = setTimeout(aoFechar, DURACAO_MS);
    return () => clearTimeout(id);
  }, [venda, aoFechar]);

  return (
    <AnimatePresence>
      {venda && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduzir ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduzir ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="heroi fixed right-4 top-4 z-[100] w-[min(22rem,calc(100vw-2rem))] p-5 sm:right-6 sm:top-6"
        >
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-3">
            <motion.span
              initial={reduzir ? false : { rotate: -25, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
              className="flex size-11 items-center justify-center rounded-xl bg-sucesso/20 text-sucesso"
            >
              <PartyPopper className="size-5" />
            </motion.span>
            <div>
              <p className="font-display text-lg font-semibold text-white">Nova venda!</p>
              <p className="text-xs text-white/60">Pagamento confirmado</p>
            </div>
          </div>

          <motion.p
            initial={reduzir ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-4 font-display text-4xl font-semibold tracking-tight text-white num"
          >
            {formatarDinheiro(venda.valorCentavos, venda.moeda)}
          </motion.p>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {venda.cliente && (
              <>
                <dt className="text-white/55">Cliente</dt>
                <dd className="truncate font-medium text-white">{venda.cliente}</dd>
              </>
            )}
            {venda.empresa && (
              <>
                <dt className="text-white/55">Empresa</dt>
                <dd className="truncate font-medium text-white">{venda.empresa}</dd>
              </>
            )}
            <dt className="text-white/55">Serviço</dt>
            <dd className="truncate font-medium text-white">{venda.servico}</dd>
            <dt className="text-white/55">Pagamento</dt>
            <dd className="font-medium text-sucesso">Confirmado{venda.meio && ROTULO_MEIO[venda.meio] ? ` · ${ROTULO_MEIO[venda.meio]}` : ""}</dd>
            <dt className="text-white/55">Data</dt>
            <dd className="font-medium text-white">{formatarData(venda.data)}</dd>
          </dl>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <Marca logoUrl={logoUrl} nome={empresa.split(" ")[0] ?? "Vynexa"} sufixo={null} className="scale-90 origin-left" />
            <span className="text-[0.7rem] text-white/50">Receita atualizada</span>
          </div>

          <motion.span
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-ciano to-brilho"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: DURACAO_MS / 1000, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
