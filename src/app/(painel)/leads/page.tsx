import { Users } from "lucide-react";
import { Suspense } from "react";

import { AbasPagina } from "@/components/base/abas-pagina";
import { Cabecalho } from "@/components/base/cartao";
import { TelaLeads } from "@/components/leads/tela-leads";
import { abasDeLeads } from "@/components/leads/abas-leads";
import { listarLeads, opcoesDeFiltro } from "@/db/leads";
import { filtrosDaUrl } from "@/server/esquemas";

export const metadata = { title: "Leads" };

const POR_PAGINA = 40;

export default async function PaginaLeads({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const filtros = filtrosDaUrl(sp as Record<string, string>);
  const aba = filtros.paraAbordar ? "abordar" : "todos";
  const [{ itens, total }, opcoes, abas] = await Promise.all([listarLeads(filtros, pagina, POR_PAGINA), opcoesDeFiltro(), abasDeLeads(filtros.busca)]);

  return (
    <div>
      <Cabecalho
        icone={Users}
        titulo="Leads"
        descricao="Marque as empresas e envie por WhatsApp ou e-mail na barra que aparece embaixo. Clique no nome para ver os detalhes."
      />
      <AbasPagina abas={abas} ativa={aba} />
      <Suspense>
        <TelaLeads itens={itens} total={total} pagina={pagina} porPagina={POR_PAGINA} opcoes={opcoes} aba={aba} />
      </Suspense>
    </div>
  );
}
