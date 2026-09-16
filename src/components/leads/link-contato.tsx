"use client";

import type { ReactNode } from "react";

import { mudarEtapaLead } from "@/server/acoes-leads";

/**
 * Link de WhatsApp ou e-mail que, ao ser clicado, marca o lead como
 * "contatado" — só se ainda estava em "novo". Abrir a conversa é o
 * contato; pedir que o operador anote isso à mão era pedir para o funil
 * ficar mentindo.
 */
export function LinkContato({
  href,
  empresaId,
  className,
  title,
  children,
}: {
  href: string;
  empresaId: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={className}
      onClick={() => {
        // Sem await: a navegação abre na hora; a etapa muda em segundo plano.
        void mudarEtapaLead(empresaId, "contatado", { soSeNovo: true });
      }}
    >
      {children}
    </a>
  );
}
