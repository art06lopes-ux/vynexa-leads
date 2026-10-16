import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Shell } from "@/components/shell/shell";
import type { ContaShell } from "@/components/shell/conta-contexto";
import { contadoresNav, lerIdentidade } from "@/db/painel";
import { diasRestantes } from "@/services/contas";
import { exigirSessao, type SessaoAtual } from "@/server/sessao";

/** Telas que abrem mesmo com a assinatura vencida: é por elas que se regulariza. */
const LIVRES_SEM_ASSINATURA = ["/assinatura", "/tutoriais", "/configuracoes"];

function avisoDaConta(s: SessaoAtual): ContaShell["aviso"] {
  if (s.ehDono) return null;
  const dias = diasRestantes(s.conta);
  if (s.conta.status === "teste" && dias !== null) {
    if (dias <= 0) return { texto: "Seu teste grátis acabou.", tom: "alerta" };
    return { texto: dias === 1 ? "Último dia do teste grátis." : `Teste grátis: faltam ${dias} dias.`, tom: dias <= 2 ? "alerta" : "info" };
  }
  if (s.conta.status === "atrasada") return { texto: "Há uma cobrança da sua assinatura em aberto.", tom: "alerta" };
  if (s.conta.status === "cancelada" && dias !== null && dias > 0) return { texto: `Assinatura cancelada: acesso até ${dias === 1 ? "amanhã" : `daqui a ${dias} dias`}.`, tom: "info" };
  return null;
}

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  // Repete a checagem do proxy de propósito: o `matcher` é uma expressão
  // regular, e uma rota nova pode escapar dela sem ninguém notar. O layout
  // não roda de novo a cada navegação; por isso as telas de plano acima
  // conferem o recurso na própria página (`exigirRecursoNaPagina`).
  const sessao = await exigirSessao();
  const caminho = (await headers()).get("x-caminho") ?? "/";
  const sob = (p: string) => caminho === p || caminho.startsWith(`${p}/`);

  if (!sessao.acesso.liberado && !LIVRES_SEM_ASSINATURA.some(sob)) redirect("/assinatura");

  const [identidade, contadores] = await Promise.all([lerIdentidade(), contadoresNav()]);

  return (
    <Shell
      contadores={contadores}
      logoUrl={identidade.logoUrl}
      empresa={identidade.empresa}
      responsavel={sessao.ehDono ? identidade.responsavel : sessao.usuario.nome}
      conta={{ recursos: sessao.recursos, ehDono: sessao.ehDono, planoNome: sessao.plano.nome, aviso: avisoDaConta(sessao) }}
    >
      {children}
    </Shell>
  );
}
