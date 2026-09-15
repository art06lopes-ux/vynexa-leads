import type { Metadata } from "next";

import { FormularioBusca } from "@/app/(painel)/buscar/formulario-busca";
import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { Card, CardContent } from "@/components/ui/card";
import { listarEstados, type UF } from "@/lib/geo/ibge";

export const metadata: Metadata = { title: "Buscar" };

export default async function PaginaBusca() {
  // Se o IBGE estiver fora do ar, a busca internacional continua
  // funcionando: só o seletor de estado brasileiro fica vazio, e o
  // formulário avisa. Derrubar a página inteira por causa disso seria
  // desproporcional.
  let estados: UF[] = [];
  let erroIbge: string | null = null;

  try {
    estados = await listarEstados();
  } catch (erro) {
    erroIbge = erro instanceof Error ? erro.message : "Falha ao consultar o IBGE.";
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        olho="Radar de prospecção"
        titulo="Caçar empresas"
        descricao="A consulta roda em segundo plano: OpenStreetMap para localizar e, no Brasil, a base da Receita Federal para telefone e e-mail. Pode sair desta tela — o resultado aparece no painel quando terminar."
      />

      <FormularioBusca estados={estados} erroIbge={erroIbge} />

      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Como a busca se comporta</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              A área começa nos limites da cidade e vai abrindo — 8, 25 e 60 km — só enquanto vier
              pouco resultado.
            </li>
            <li>
              Empresas já encontradas em buscas anteriores não entram de novo: o dedup é pelo
              identificador do OpenStreetMap.
            </li>
            <li>
              Se a região tiver menos empresas mapeadas do que você pediu, vem o que existe. Nada é
              completado com dado inventado.
            </li>
            <li>
              A fila é processada a cada 5 minutos pelo GitHub Actions. O agendamento é best effort
              e pode atrasar em horário de pico.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
