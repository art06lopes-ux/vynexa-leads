import { cn } from "@/lib/utils";

/**
 * Marca da Vynexa.
 *
 * Com logo enviado em Configurações → Identidade, mostra a imagem real.
 * Sem logo, o V da Vynexa em brasa ao lado do nome.
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

/** O V real da Vynexa, recolorido em brasa (scripts/gerar-marca-brasa.cjs). */
export function MonogramaProvisorio({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG pequeno da própria marca
    <img src="/marca/v-brasa-96.png" alt="" width={32} height={32} className={cn("size-8 shrink-0 object-contain drop-shadow-[0_2px_10px_rgba(255,90,31,0.45)]", className)} />
  );
}
