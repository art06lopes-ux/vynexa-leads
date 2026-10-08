import { MessageCircle } from "lucide-react";

import { ListaWhatsapp } from "@/components/abordar/lista-whatsapp";
import { Cabecalho } from "@/components/base/cartao";
import { carregarFila } from "@/db/abordar";
import { getBanco } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";

export const metadata = { title: "Enviar pelo WhatsApp" };

/**
 * Enviar pelo WhatsApp: as empresas escolhidas em Leads (`?selecao=1`,
 * pelo navegador) ou as de uma busca (`?busca=<id>`). Sem nenhum dos dois,
 * a tela explica como escolher.
 */
export default async function PaginaWhatsapp({ searchParams }: PageProps<"/abordar">) {
  const { busca } = await searchParams;
  const buscaId = typeof busca === "string" && busca ? busca : null;
  const banco = getBanco();

  const [identidade, itens, rotuloBusca] = await Promise.all([
    lerIdentidade(),
    buscaId ? carregarFila(banco, { buscaId }) : Promise.resolve(null),
    buscaId
      ? banco
          .execute({ sql: `SELECT consulta_natural, segmento, cidade FROM buscas WHERE id = ?`, args: [buscaId] })
          .then(({ rows }) => (rows[0] ? String(rows[0].consulta_natural ?? `${String(rows[0].segmento)}${rows[0].cidade ? ` em ${String(rows[0].cidade)}` : ""}`) : "Busca"))
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <Cabecalho
        icone={MessageCircle}
        titulo="Enviar pelo WhatsApp"
        trilha={[{ href: "/leads?situacao=nao_abordados", rotulo: "Leads" }]}
        descricao="Todas as empresas escolhidas, cada uma com a mensagem pronta. Abra no WhatsApp as que quiser, na ordem que quiser."
      />
      <ListaWhatsapp
        itensIniciais={itens}
        origem={buscaId ? { tipo: "busca", rotulo: rotuloBusca ?? "Busca", buscaId } : { tipo: "selecao", rotulo: "Empresas escolhidas em Leads", buscaId: null }}
        remetente={{ responsavel: identidade.responsavel || "Artur", empresa: identidade.empresa || "Vynexa Dev" }}
      />
    </div>
  );
}
