import { Megaphone } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { NovaCampanha } from "@/components/campanhas/nova-campanha";
import { opcoesDeFiltro } from "@/db/leads";
import { lerIdentidade } from "@/db/painel";
import { estadoProvedoresEmail } from "@/integrations/email";

export const metadata = { title: "Nova campanha" };

export default async function PaginaNovaCampanha() {
  const [provedores, identidade, opcoes] = await Promise.all([estadoProvedoresEmail(), lerIdentidade(), opcoesDeFiltro()]);
  return (
    <div>
      <Cabecalho icone={Megaphone} titulo="Nova campanha" trilha={[{ href: "/campanhas", rotulo: "Campanhas" }]} descricao="Escolha os leads, defina o ritmo e revise antes de qualquer envio." />
      <NovaCampanha provedores={provedores} provedorPadrao={identidade.config.email_provedor || "gmail"} categorias={opcoes.categorias} cidades={opcoes.cidades} />
    </div>
  );
}
