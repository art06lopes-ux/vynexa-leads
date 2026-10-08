import { Users } from "lucide-react";
import { Suspense } from "react";

import { AbasPagina } from "@/components/base/abas-pagina";
import { Cabecalho } from "@/components/base/cartao";
import { abasDeLeads } from "@/components/leads/abas-leads";
import { TelaLeads } from "@/components/leads/tela-leads";
import { listarLeads, opcoesDeFiltro } from "@/db/leads";
import { filtrosDaUrl } from "@/server/esquemas";

export const metadata = { title: "Leads" };

const POR_PAGINA = 40;

export default async function PaginaLeads({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const filtros = filtrosDaUrl(sp as Record<string, string>);
  const [{ itens, total }, opcoes, abas] = await Promise.all([
    listarLeads(filtros, pagina, POR_PAGINA),
    opcoesDeFiltro({ pais: filtros.pais, estado: filtros.estado }),
    abasDeLeads(filtros.busca),
  ]);

  return (
    <div>
      <Cabecalho
        icone={Users}
        titulo="Leads"
        descricao="Filtre por lugar, nicho e situação, marque as empresas e envie por WhatsApp ou e-mail na barra que aparece embaixo."
      />
      <AbasPagina abas={abas} ativa="lista" />
      <Suspense>
        <TelaLeads itens={itens} total={total} pagina={pagina} porPagina={POR_PAGINA} opcoes={opcoes} />
      </Suspense>
    </div>
  );
}
