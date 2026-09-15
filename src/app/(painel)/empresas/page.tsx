import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";

import { Filtros } from "@/components/leads/filtros";
import {
  BarraCampanha,
  SelecaoProvider,
} from "@/components/leads/selecao-campanha";
import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { TabelaEmpresas } from "@/components/leads/tabela-empresas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listarEmpresas,
  obterOpcoesDeFiltro,
  type Filtros as TipoFiltros,
} from "@/db/consultas";

export const metadata: Metadata = { title: "Empresas" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

function lerBooleano(
  valor: string | string[] | undefined,
): boolean | undefined {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return undefined;
}

/** Score mínimo. Valor não numérico é ignorado em vez de virar NaN no SQL. */
function lerNumero(valor: string | string[] | undefined): number | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(v);
  return v && Number.isFinite(n) ? n : undefined;
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

export default async function PaginaEmpresas({
  searchParams,
}: PageProps<"/empresas">) {
  const sp = await searchParams;

  const filtros: TipoFiltros = {
    segmento: primeiro(sp.segmento),
    pais: primeiro(sp.pais),
    estado: primeiro(sp.estado),
    cidade: primeiro(sp.cidade),
    temSite: lerBooleano(sp.temSite),
    temEmail: lerBooleano(sp.temEmail),
    temTelefone: lerBooleano(sp.temTelefone),
    scoreMin: lerNumero(sp.scoreMin),
    canal:
      primeiro(sp.canal) === "whatsapp"
        ? "whatsapp"
        : primeiro(sp.canal) === "email"
          ? "email"
          : undefined,
    fonte:
      primeiro(sp.fonte) === "osm" ? "osm" : primeiro(sp.fonte) === "receita" ? "receita" : undefined,
    busca: primeiro(sp.q),
  };

  const pagina = Math.max(1, Number(primeiro(sp.pagina) ?? 1) || 1);

  const [{ itens, total }, opcoes] = await Promise.all([
    listarEmpresas(filtros, pagina, POR_PAGINA),
    obterOpcoesDeFiltro(),
  ]);

  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <SelecaoProvider>
      <div className="flex flex-col gap-6">
        <CabecalhoPagina
          olho="Carteira"
          titulo="Empresas"
          descricao="Tudo o que veio do OpenStreetMap, sem duplicatas. Os filtros vão para a URL — o CSV sai com exatamente o que estiver na tela."
        />

        <Card>
          <CardContent className="pt-6">
            {/* `useSearchParams` obriga a fronteira de Suspense; sem ela a
              página inteira vira renderização sob demanda no cliente. */}
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Filtros opcoes={opcoes} total={total} />
            </Suspense>
          </CardContent>
        </Card>

        {itens.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Building2
                className="size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">
                {total === 0
                  ? "Nenhuma empresa na carteira"
                  : "Nenhuma empresa com esses filtros"}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {total === 0
                  ? "Faça uma busca para começar a preencher a carteira."
                  : "Afrouxe algum filtro ou limpe todos para ver a lista inteira."}
              </p>
              {total === 0 && (
                <Button
                  render={<Link href="/buscar" />}
                  nativeButton={false}
                  className="mt-2 h-11 cursor-pointer"
                >
                  Buscar empresas
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <TabelaEmpresas empresas={itens} />

            {ultimaPagina > 1 && (
              <nav
                aria-label="Paginação"
                className="flex items-center justify-between gap-3 border-t border-border pt-4"
              >
                <Paginacao
                  sp={sp}
                  pagina={pagina - 1}
                  desabilitado={pagina <= 1}
                  direcao="anterior"
                />
                <p className="num text-sm text-muted-foreground">
                  Página {pagina} de {ultimaPagina}
                </p>
                <Paginacao
                  sp={sp}
                  pagina={pagina + 1}
                  desabilitado={pagina >= ultimaPagina}
                  direcao="proxima"
                />
              </nav>
            )}
          </>
        )}
      </div>
      <BarraCampanha />
    </SelecaoProvider>
  );
}

function Paginacao({
  sp,
  pagina,
  desabilitado,
  direcao,
}: {
  sp: Record<string, string | string[] | undefined>;
  pagina: number;
  desabilitado: boolean;
  direcao: "anterior" | "proxima";
}) {
  // Preserva os filtros ao paginar: sem isto, ir para a página 2 mostraria
  // a lista inteira em vez do resultado filtrado.
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(sp)) {
    const v = Array.isArray(valor) ? valor[0] : valor;
    if (v && chave !== "pagina") params.set(chave, v);
  }
  params.set("pagina", String(pagina));

  const rotulo = direcao === "anterior" ? "Anterior" : "Próxima";

  if (desabilitado) {
    return (
      <span className="inline-flex h-11 items-center gap-1.5 px-3 text-sm text-muted-foreground/50">
        {direcao === "anterior" && (
          <ChevronLeft className="size-4" aria-hidden="true" />
        )}
        {rotulo}
        {direcao === "proxima" && (
          <ChevronRight className="size-4" aria-hidden="true" />
        )}
      </span>
    );
  }

  return (
    <Button
      render={<Link href={`/empresas?${params.toString()}`} />}
      nativeButton={false}
      variant="ghost"
      className="h-11 cursor-pointer gap-1.5"
    >
      {direcao === "anterior" && (
        <ChevronLeft className="size-4" aria-hidden="true" />
      )}
      {rotulo}
      {direcao === "proxima" && (
        <ChevronRight className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
