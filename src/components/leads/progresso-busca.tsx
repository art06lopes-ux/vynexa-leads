"use client";

import { Check, LoaderCircle, Radar } from "lucide-react";

import { Particulas } from "@/components/motion/particulas";
import { cn } from "@/lib/utils";

export type EstagioBusca = "pendente" | "em_andamento" | "concluida";

/**
 * Progresso da caçada.
 *
 * Estágios, e não porcentagem. O worker não sabe quanto falta — ele faz
 * de uma a quatro consultas à Overpass conforme o resultado —, então
 * qualquer número aqui seria inventado. Mostrar "26%" enganaria o
 * operador sobre quanto tempo ainda tem, que é justamente o que ele quer
 * saber ao olhar.
 *
 * O varrimento de radar é decorativo e some sob `prefers-reduced-motion`,
 * já tratado globalmente no `globals.css`.
 */
const ESTAGIOS: Array<{ chave: EstagioBusca; rotulo: string; detalhe: string }> = [
  { chave: "pendente", rotulo: "Na fila", detalhe: "Aguardando o worker, que roda a cada 5 minutos." },
  { chave: "em_andamento", rotulo: "Rastreando", detalhe: "Consultando o mapa e, no Brasil, a base da Receita." },
  { chave: "concluida", rotulo: "Concluída", detalhe: "Empresas salvas na carteira, sem duplicatas." },
];

export function ProgressoBusca({
  estagio,
  local,
  aviso,
}: {
  estagio: EstagioBusca;
  local: string | null;
  /** Motivo de uma nova tentativa em curso (Overpass ocupada etc.). */
  aviso?: string | null;
}) {
  const indiceAtual = ESTAGIOS.findIndex((e) => e.chave === estagio);

  return (
    <div className="vidro brasa relative flex flex-col gap-4 overflow-hidden rounded-xl p-5 sm:flex-row sm:items-center sm:gap-6">
      {/* Rede de pontos atrás, só enquanto rastreia — é o "Code Hunter"
          da referência, sem o globo: partículas custam pouco, um globo
          em 3D custaria uma biblioteca inteira. */}
      {estagio !== "concluida" && (
        <Particulas densidade={45} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
      )}

      <div className="relative mx-auto size-24 shrink-0 sm:mx-0">
        {/* Anéis do radar */}
        <span className="absolute inset-0 rounded-full border border-primary/25" aria-hidden="true" />
        <span className="absolute inset-3 rounded-full border border-primary/20" aria-hidden="true" />
        <span className="absolute inset-6 rounded-full border border-primary/15" aria-hidden="true" />

        {/* Varredura: um gradiente cônico girando. Sem imagem, sem
            biblioteca, e o navegador anima só a transformação. */}
        {estagio !== "concluida" && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-full [animation-duration:2.4s]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, var(--primary) 360deg)",
              maskImage: "radial-gradient(circle, transparent 18%, black 20%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 18%, black 20%)",
              opacity: 0.55,
            }}
          />
        )}

        <span className="absolute inset-0 flex items-center justify-center">
          {estagio === "concluida" ? (
            <Check className="size-8 text-emerald-300" aria-hidden="true" />
          ) : (
            <Radar className="size-8 text-primary" aria-hidden="true" />
          )}
        </span>
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="truncate font-medium">
          {local ?? "Localizando a região…"}
        </p>
        {aviso && estagio !== "concluida" && (
          <p className="mt-1 text-xs text-amber-300/90">{aviso}</p>
        )}

        <ol className="mt-3 flex flex-col gap-2">
          {ESTAGIOS.map((e, i) => {
            const passado = i < indiceAtual;
            const atual = i === indiceAtual;

            return (
              <li
                key={e.chave}
                className={cn(
                  "flex items-start gap-2.5 text-sm transition-colors duration-200",
                  atual ? "text-foreground" : passado ? "text-muted-foreground" : "text-muted-foreground/50",
                )}
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {passado ? (
                    <Check className="size-4 text-emerald-300" aria-hidden="true" />
                  ) : atual && e.chave !== "concluida" ? (
                    <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
                  ) : atual ? (
                    <Check className="size-4 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="font-medium">{e.rotulo}</span>
                  {atual && <span className="ml-2 text-xs text-muted-foreground">{e.detalhe}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
