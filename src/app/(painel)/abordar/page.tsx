import { Send } from "lucide-react";

import { FilaAbordagem } from "@/components/abordar/fila-abordagem";
import { Cabecalho } from "@/components/base/cartao";
import { carregarFila } from "@/db/abordar";
import { getBanco } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";
import { estadoProvedoresEmail } from "@/integrations/email";

export const metadata = { title: "Abordar" };

/**
 * Abordar em massa: a fila de quem ainda não foi contatado.
 * `?busca=<id>` → as empresas de uma busca; `?selecao=1` → os leads
 * selecionados na lista (vêm pelo navegador); sem nada → todos.
 */
export default async function PaginaAbordar({ searchParams }: PageProps<"/abordar">) {
  const { busca, selecao } = await searchParams;
  const buscaId = typeof busca === "string" && busca ? busca : null;
  const deSelecao = selecao === "1";
  const banco = getBanco();

  const [identidade, provedores, itens, rotuloBusca] = await Promise.all([
    lerIdentidade(),
    estadoProvedoresEmail(),
    deSelecao ? Promise.resolve(null) : carregarFila(banco, { buscaId }),
    buscaId
      ? banco
          .execute({ sql: `SELECT consulta_natural, segmento, cidade, estado FROM buscas WHERE id = ?`, args: [buscaId] })
          .then(({ rows }) => {
            const b = rows[0];
            if (!b) return "Busca";
            return b.consulta_natural ? String(b.consulta_natural) : `${String(b.segmento)}${b.cidade ? ` em ${String(b.cidade)}` : b.estado ? ` em ${String(b.estado)}` : ""}`;
          })
      : Promise.resolve(null),
  ]);

  const padrao = identidade.config.email_provedor || "gmail";
  const prov = provedores.find((p) => p.nome === padrao);
  const origem = buscaId
    ? { tipo: "busca" as const, rotulo: rotuloBusca ?? "Busca", buscaId }
    : deSelecao
      ? { tipo: "selecao" as const, rotulo: "Leads selecionados", buscaId: null }
      : { tipo: "todos" as const, rotulo: "Leads ainda não abordados", buscaId: null };

  return (
    <div>
      <Cabecalho
        icone={Send}
        titulo="Abordar"
        descricao={`${origem.rotulo}. E-mail para todos num clique; WhatsApp em sequência, com a mensagem pronta — sem abrir lead por lead.`}
      />
      <FilaAbordagem
        itensIniciais={itens}
        origem={origem}
        remetente={{ responsavel: identidade.responsavel || "Artur", empresa: identidade.empresa || "Vynexa Dev" }}
        email={{ provedor: padrao, pronto: Boolean(prov?.ok), motivo: prov?.motivo ?? null }}
      />
    </div>
  );
}
