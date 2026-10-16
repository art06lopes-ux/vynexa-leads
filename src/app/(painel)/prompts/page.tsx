import { Wand2 } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { TelaPrompts } from "@/components/prompts/tela-prompts";
import { listarPrompts } from "@/db/prompts";
import { obterIA } from "@/integrations/ai";
import { exigirRecursoNaPagina } from "@/server/sessao";

export const metadata = { title: "Gerador de prompts" };

export default async function PaginaPrompts() {
  await exigirRecursoNaPagina("prompts");
  const [salvos, iaOk] = await Promise.all([listarPrompts(), obterIA().disponivel()]);
  return (
    <div>
      <Cabecalho
        icone={Wand2}
        secao="Ferramentas"
        titulo="Gerador de prompts"
        descricao="Escreva a ideia do jeito que vier. O gerador devolve um pedido completo para o Claude Code — contexto, requisitos, critérios de aceite e como testar."
      />
      <TelaPrompts salvos={salvos} iaOk={iaOk} />
    </div>
  );
}
