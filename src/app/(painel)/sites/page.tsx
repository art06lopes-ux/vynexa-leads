import { Globe } from "lucide-react";
import { Suspense } from "react";

import { Cabecalho } from "@/components/base/cartao";
import { Contador } from "@/components/motion/contador";
import { TelaSites } from "@/components/sites/tela-sites";
import { carteira, listarProjetos } from "@/db/carteira";

export const metadata = { title: "Sites" };

export default async function PaginaSites() {
  const [projetos, clientes] = await Promise.all([listarProjetos(), carteira()]);
  const ativos = projetos.filter((p) => p.status !== "arquivado");
  const publicados = projetos.filter((p) => p.status === "publicado").length;
  const andamento = projetos.filter((p) => ["briefing", "desenvolvimento", "revisao"].includes(p.status)).length;
  const valor = ativos.reduce((s, p) => s + p.valor_centavos, 0);
  const margem = ativos.reduce((s, p) => s + p.valor_centavos - p.custo_centavos, 0);

  return (
    <div>
      <Cabecalho
        icone={Globe}
        secao="Entrega"
        titulo="Sites"
        descricao="O portfólio da Vynexa: cada site, landing page e sistema entregue, com a página no ar, o prazo e quanto sobrou de margem."
        numeros={[
          { valor: <Contador valor={publicados} />, rotulo: "publicados" },
          { valor: <Contador valor={andamento} />, rotulo: "em andamento" },
          { valor: <Contador valor={valor} formato="moeda" />, rotulo: "em projetos" },
          { valor: <Contador valor={margem} formato="moeda" />, rotulo: "de margem" },
        ]}
      />
      <Suspense>
        <TelaSites projetos={projetos} clientes={clientes.map((c) => ({ id: c.lead_id, nome: c.nome }))} />
      </Suspense>
    </div>
  );
}
