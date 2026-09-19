"use client";

import { useState, useTransition } from "react";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { anotarLead } from "@/server/acoes-leads";

/**
 * Observação livre do lead — "ligar quinta", "pediu orçamento de loja".
 *
 * Aparece como texto; um clique vira caixa de edição; sair da caixa
 * salva. Sem botão de salvar de propósito: é anotação de passagem, e o
 * atrito de um botão a mais é a diferença entre anotar e não anotar.
 */
export function ObservacaoLead({ empresaId, observacao }: { empresaId: string; observacao: string | null }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(observacao ?? "");
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setEditando(false);
    if (texto.trim() === (observacao ?? "").trim()) return;
    iniciar(async () => {
      const r = await anotarLead(empresaId, texto);
      if (!r.ok) toast.error("Não consegui salvar a observação.");
    });
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setTexto(observacao ?? "");
              setEditando(false);
            }
          }}
          maxLength={500}
          rows={3}
          placeholder="O que combinou, quando voltar…"
          aria-label="Observação"
          className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:border-ring"
        />
        {/* Só aparece perto do teto: abaixo disso o limite não é uma
            informação que ajuda, só polui uma anotação de passagem. */}
        {texto.length > 400 && (
          <span className="num self-end text-[0.65rem] text-muted-foreground">{texto.length}/500</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      disabled={pendente}
      className="flex w-full cursor-text items-start gap-1.5 rounded-md px-1 py-1 text-left text-xs text-muted-foreground transition-colors duration-200 hover:bg-white/4 hover:text-foreground"
    >
      <NotebookPen className="mt-px size-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span className={texto ? "line-clamp-2 whitespace-pre-wrap" : "italic opacity-70"}>
        {texto || "Anotar…"}
      </span>
    </button>
  );
}
