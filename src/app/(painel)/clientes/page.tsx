import { Handshake } from "lucide-react";
import { Suspense } from "react";

import { Cabecalho } from "@/components/base/cartao";
import { TelaClientes } from "@/components/clientes/tela-clientes";
import { Contador } from "@/components/motion/contador";
import { carteira, receitaTotal } from "@/db/carteira";
import { normalizarTelefone } from "@/lib/leads/whatsapp";

export const metadata = { title: "Clientes" };

export default async function PaginaClientes() {
  const [clientes, receita] = await Promise.all([carteira(), receitaTotal()]);
  const conta = (e: string) => clientes.filter((c) => c.etapa === e).length;

  return (
    <div>
      <Cabecalho
        icone={Handshake}
        secao="Entrega"
        titulo="Clientes"
        descricao="Do primeiro “oi” ao site no ar: cada relacionamento com o estágio da conversa, a entrega digital e o que já rendeu."
        numeros={[
          { valor: <Contador valor={conta("fechado")} />, rotulo: "clientes fechados" },
          { valor: <Contador valor={conta("negociacao") + conta("respondeu")} />, rotulo: "em negociação" },
          { valor: <Contador valor={conta("proposta")} />, rotulo: "propostas enviadas" },
          { valor: <Contador valor={receita} formato="moeda" />, rotulo: "receita gerada" },
        ]}
      />
      <Suspense>
        <TelaClientes clientes={clientes.map((c) => ({ ...c, whats: normalizarTelefone(c.telefone, c.pais || "BR") }))} />
      </Suspense>
    </div>
  );
}
