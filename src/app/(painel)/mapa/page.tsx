import { Users } from "lucide-react";

import { AbasPagina } from "@/components/base/abas-pagina";
import { Cabecalho } from "@/components/base/cartao";
import { abasDeLeads } from "@/components/leads/abas-leads";
import { MapaCliente } from "@/components/mapa/mapa-cliente";

export const metadata = { title: "Mapa" };

export default async function PaginaMapa({ searchParams }: PageProps<"/mapa">) {
  const { busca } = await searchParams;
  const abas = await abasDeLeads(typeof busca === "string" ? busca : null);
  return (
    <div>
      <Cabecalho icone={Users} titulo="Leads" descricao="As empresas no mapa. Clique num ponto para ver o resumo; selecione uma área para agir em massa ou buscar só ali." />
      <AbasPagina abas={abas} ativa="mapa" />
      <MapaCliente />
    </div>
  );
}
