"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

/**
 * Movimento de entrada. Um orçamento curto (180–320 ms) e deslocamento
 * pequeno: a tela é de trabalho, a animação diz "isto chegou" e sai do
 * caminho. Com "reduzir movimento" ligado, só opacidade.
 */

export function Entrada({ atraso = 0, className, children, ...resto }: HTMLMotionProps<"div"> & { atraso?: number }) {
  const reduzir = useReducedMotion();
  return (
    <motion.div
      initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: atraso }}
      className={className}
      {...resto}
    >
      {children}
    </motion.div>
  );
}

const pai = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const filho = {
  oculto: { opacity: 0, y: 8 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Escalonado({ className, children, ...resto }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={pai} initial="oculto" animate="visivel" className={className} {...resto}>
      {children}
    </motion.div>
  );
}

export function ItemEscalonado({ className, children, ...resto }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={filho} className={className} {...resto}>
      {children}
    </motion.div>
  );
}
