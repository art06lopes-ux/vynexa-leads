import { Shell } from "@/components/shell/shell";
import { contadoresNav, lerIdentidade } from "@/db/painel";
import { exigirSessao } from "@/server/sessao";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  // Repete a checagem do proxy de propósito: o `matcher` é uma expressão
  // regular, e uma rota nova pode escapar dela sem ninguém notar.
  await exigirSessao();
  const [identidade, contadores] = await Promise.all([lerIdentidade(), contadoresNav()]);

  return (
    <Shell contadores={contadores} logoUrl={identidade.logoUrl} empresa={identidade.empresa} responsavel={identidade.responsavel}>
      {children}
    </Shell>
  );
}
