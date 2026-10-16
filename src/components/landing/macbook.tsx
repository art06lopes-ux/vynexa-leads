"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Um MacBook desenhado em CSS (sem imagem): tampa com moldura e câmera,
 * tela 16:10 e a base com o recorte da abertura. A tela recebe a
 * interface do produto montada numa "tela virtual" de 1280×800 e
 * escalada para caber — fica nítida em qualquer tamanho, e cada tela
 * pode ser animada de verdade.
 *
 * `abrir`: a tampa abre ao entrar na tela (o momento de abertura da landing).
 */

const LARGURA_VIRTUAL = 1280;

export function TelaVirtual({ children }: { children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / LARGURA_VIRTUAL);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={caixa} className="absolute inset-0 overflow-hidden">
      <div className="origin-top-left" style={{ width: LARGURA_VIRTUAL, height: 800, transform: `scale(${escala})` }}>
        {children}
      </div>
    </div>
  );
}

export function MacBook({ children, abrir = false, className }: { children: React.ReactNode; abrir?: boolean; className?: string }) {
  const reduzir = useReducedMotion();
  const animarTampa = abrir && !reduzir;
  // Mede o contêiner (a tampa inclinada é quase achatada e nunca "entra na tela").
  const caixa = useRef<HTMLDivElement>(null);
  const visivel = useInView(caixa, { once: true, amount: 0.25 });
  return (
    <div ref={caixa} className={cn("relative mx-auto w-full [perspective:2400px]", className)}>
      {/* Tampa */}
      <motion.div
        className="relative mx-auto w-[86%] origin-bottom rounded-t-[2.2%_3.4%] bg-gradient-to-b from-[#3a3633] to-[#1c1a19] p-[1.1%] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_40px_120px_-30px_rgba(255,90,31,0.45)]"
        initial={animarTampa ? { rotateX: -88, opacity: 0.6 } : false}
        animate={animarTampa ? (visivel ? { rotateX: 0, opacity: 1 } : { rotateX: -88, opacity: 0.6 }) : undefined}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="relative overflow-hidden rounded-[1.6%_1.6%_0.4%_0.4%] bg-black">
          {/* câmera */}
          <span className="absolute left-1/2 top-[0.9%] z-20 size-[0.55%] min-h-1 min-w-1 -translate-x-1/2 rounded-full bg-[#1d1d1f] ring-1 ring-white/10" aria-hidden="true" />
          <div className="relative aspect-[16/10] w-full">{children}</div>
          {/* reflexo do vidro */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07)_0%,transparent_32%,transparent_70%,rgba(255,255,255,0.03)_100%)]" />
        </div>
      </motion.div>
      {/* Base */}
      <div aria-hidden="true" className="relative mx-auto h-[1.4vw] max-h-4 min-h-2 w-full rounded-b-[40%_100%] bg-gradient-to-b from-[#4a4642] via-[#2c2927] to-[#141312] shadow-[0_30px_50px_-20px_rgba(0,0,0,0.9)]">
        <span className="absolute left-1/2 top-0 h-1/2 w-[14%] -translate-x-1/2 rounded-b-lg bg-[#1a1817]" />
      </div>
    </div>
  );
}
