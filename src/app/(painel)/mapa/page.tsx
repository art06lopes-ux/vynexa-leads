import { Map } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { MapaCliente } from "@/components/mapa/mapa-cliente";

export const metadata = { title: "Mapa" };

export default function PaginaMapa() {
  return (
    <div>
      <Cabecalho icone={Map} titulo="Mapa" descricao="Os leads onde eles estão. Clique num ponto para ver o resumo; selecione uma área para agir em massa ou buscar só ali." />
      <MapaCliente />
    </div>
  );
}
