import { Search } from "lucide-react";
import { Suspense } from "react";

import { AvisoConfiguracao, Cabecalho } from "@/components/base/cartao";
import { TelaBusca } from "@/components/busca/tela-busca";
import { estadoDosProvedores } from "@/integrations/leads";

export const metadata = { title: "Buscar leads" };

export default async function PaginaBuscar({ searchParams }: PageProps<"/buscar">) {
  const { busca } = await searchParams;
  const provedores = await estadoDosProvedores();
  const google = provedores.find((p) => p.nome === "google_places");

  return (
    <div>
      <Cabecalho icone={Search} titulo="Buscar leads" descricao="Qualquer categoria, em qualquer lugar do mundo. O sistema encontra, remove duplicatas, avalia a presença digital e calcula a oportunidade." />
      {!google?.disponivel && (
        <div className="mb-5">
          <AvisoConfiguracao titulo="Google Maps ainda não configurado">
            As buscas usam a Google Places API, a forma oficial de consultar o Google Maps. Cole a chave em Configurações → Integrações para buscar.
          </AvisoConfiguracao>
        </div>
      )}
      <Suspense>
        <TelaBusca provedores={provedores} buscaInicial={typeof busca === "string" ? busca : null} />
      </Suspense>
    </div>
  );
}
