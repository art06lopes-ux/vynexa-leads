import { cn } from "@/lib/utils";

/**
 * Marca da Vynexa Dev.
 *
 * SVG inline e não arquivo: são 40 bytes de path, e inline evita uma
 * requisição e o salto de layout que um `<img>` sem dimensão causaria no
 * cabeçalho.
 */
export function Marca({ className, mostrarTexto = true }: { className?: string; mostrarTexto?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label="Vynexa Dev"
      >
        <defs>
          <linearGradient id="vynexa-marca" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#vynexa-marca)" />
        <path
          d="M9 10.5 L16 22 L23 10.5"
          fill="none"
          stroke="#0c0a0a"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {mostrarTexto && (
        <span className="hidden items-baseline gap-1.5 leading-none sm:flex">
          <span className="font-mono text-xs text-neon" aria-hidden="true">
            &lt;/&gt;
          </span>
          <span className="text-[0.95rem] font-bold uppercase tracking-[0.18em] text-foreground">
            Vynexa
          </span>
        </span>
      )}
    </span>
  );
}
