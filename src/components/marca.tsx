import { cn } from "@/lib/utils";

/**
 * Marca da Vynexa.
 *
 * Com logo enviado em Configurações → Identidade, mostra a imagem real —
 * nunca uma reconstrução em texto. Sem logo, um monograma provisório:
 * um "V" desenhado como dois traços que se encontram num nó, a ideia de
 * "conectar" do produto, sobre a pastilha azul do sistema.
 */
export function Marca({
  className,
  logoUrl,
  nome = "Vynexa",
  sufixo = "Leads",
  mostrarTexto = true,
}: {
  className?: string;
  logoUrl?: string | null;
  nome?: string;
  sufixo?: string | null;
  mostrarTexto?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo vem do banco, tamanho variável
        <img src={logoUrl} alt={nome} className="h-8 w-auto max-w-[8.5rem] shrink-0 object-contain" />
      ) : (
        <MonogramaProvisorio />
      )}
      {mostrarTexto && !logoUrl && (
        <span className="flex items-baseline gap-1 leading-none">
          <span className="font-display text-[0.98rem] font-semibold tracking-tight text-foreground">{nome}</span>
          {sufixo && <span className="font-display text-[0.98rem] font-light text-muted-foreground">{sufixo}</span>}
        </span>
      )}
    </span>
  );
}

export function MonogramaProvisorio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role="img" aria-label="Vynexa">
      <defs>
        <linearGradient id="vx-fundo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d73ff" />
          <stop offset="100%" stopColor="#1f47d6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#vx-fundo)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="rgba(255,255,255,0.22)" />
      <path d="M9.5 9.5 L16 21.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22.5 9.5 L16 21.5" stroke="#bfe9ff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="22" r="2.4" fill="#6fd3ff" stroke="#1f47d6" strokeWidth="1" />
    </svg>
  );
}
