"use client";

import { useState } from "react";
import { AtSign, Check, Copy, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { EmpresaListada } from "@/db/consultas";
import { formatarTelefone, montarLinkWhatsApp } from "@/lib/leads/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Faixa do score, em cor e palavra.
 *
 * A palavra existe porque a cor sozinha não é acessível — e porque
 * "Alta" é mais rápido de ler numa lista de cinquenta linhas do que
 * comparar tons de vermelho.
 */
function faixa(score: number): { rotulo: string; classe: string } {
  if (score >= 70) return { rotulo: "Alta", classe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
  if (score >= 45) return { rotulo: "Média", classe: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
  return { rotulo: "Baixa", classe: "border-slate-400/25 bg-slate-400/10 text-slate-300" };
}

export function BadgeScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">Sem análise</span>;
  }

  const { rotulo, classe } = faixa(score);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        classe,
      )}
    >
      <span className="num font-semibold">{score}</span>
      {rotulo}
    </span>
  );
}

export function AcaoLead({ empresa }: { empresa: EmpresaListada }) {
  const [copiado, setCopiado] = useState(false);

  const mensagem = empresa.mensagem_gerada;

  // Estado explícito e não botão sumido — mesmo raciocínio do "sem
  // telefone utilizável" mais abaixo: o operador precisa saber que falta
  // a análise, não achar que a linha está quebrada.
  if (!mensagem) {
    return <span className="text-xs text-muted-foreground">Sem mensagem gerada</span>;
  }

  const linkWhatsapp = montarLinkWhatsApp(empresa.telefone, mensagem, empresa.pais);
  const linkEmail = empresa.email
    ? `mailto:${empresa.email}?subject=${encodeURIComponent(
        `Site para ${empresa.nome}`,
      )}&body=${encodeURIComponent(mensagem)}`
    : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem!);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Área de transferência bloqueada acontece em contexto não seguro
      // e quando o usuário nega a permissão. Avisar é melhor do que o
      // botão simplesmente não fazer nada.
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="secondary" className="h-9 cursor-pointer gap-1.5 px-2.5 text-xs" />
        }
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        Abordar
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{empresa.nome}</DialogTitle>
          <DialogDescription>
            {empresa.motivo_problema ?? "Mensagem gerada pela análise."}
          </DialogDescription>
        </DialogHeader>

        {/* `whitespace-pre-wrap` preserva as quebras que o modelo escreveu;
            sem isso a mensagem vira um parágrafo só e não se parece com o
            que vai chegar no WhatsApp. */}
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card/60 p-3 text-sm">
          {mensagem}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {linkWhatsapp ? (
            <Button
              render={<a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              className="h-11 cursor-pointer gap-2"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
              <span className="num text-xs opacity-80">
                {formatarTelefone(empresa.telefone, empresa.pais)}
              </span>
            </Button>
          ) : (
            // Estado explícito em vez de botão sumido: o operador precisa
            // saber que falta o telefone, não achar que a ferramenta falhou.
            <span className="text-xs text-amber-300/90">
              Sem telefone utilizável — busque o número por fora e edite o lead.
            </span>
          )}

          {linkEmail && (
            <Button
              render={<a href={linkEmail} />}
              nativeButton={false}
              variant="secondary"
              className="h-11 cursor-pointer gap-2"
            >
              <AtSign className="size-4" aria-hidden="true" />
              E-mail
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={copiar}
            className="ml-auto h-11 cursor-pointer gap-2 text-muted-foreground"
          >
            {copiado ? (
              <>
                <Check className="size-4 text-emerald-300" aria-hidden="true" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
