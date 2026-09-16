"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Download, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nomeDoPais } from "@/lib/geo/paises";
import { ETAPAS, ROTULO_ETAPA } from "@/lib/leads/etapas";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";

export type Opcoes = {
  segmentos: string[];
  paises: string[];
  estados: string[];
  cidades: string[];
};

const TRIPLICE = [
  { valor: "", rotulo: "Todos" },
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
] as const;

export function Filtros({ opcoes, total }: { opcoes: Opcoes; total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const idBase = useId();

  /**
   * Todo filtro vive na URL, não em estado do componente.
   *
   * É o que faz o link ser compartilhável, o botão voltar funcionar e a
   * exportação em CSV sair exatamente com o que está na tela — a rota de
   * export lê os mesmos parâmetros.
   */
  function aplicar(chave: string, valor: string) {
    const novos = new URLSearchParams(params);
    if (valor === "") novos.delete(chave);
    else novos.set(chave, valor);
    // Trocar filtro volta para a primeira página: manter a página 4 de um
    // resultado que agora tem duas mostraria uma lista vazia.
    novos.delete("pagina");
    iniciar(() => router.push(`/empresas?${novos.toString()}`));
  }

  const ativos = Array.from(params.keys()).filter((k) => k !== "pagina").length;
  const classeCampo =
    "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm transition-colors duration-200 focus-visible:border-ring";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-seg`} className="text-xs text-muted-foreground">
            Segmento
          </Label>
          <select
            id={`${idBase}-seg`}
            value={params.get("segmento") ?? ""}
            onChange={(e) => aplicar("segmento", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {opcoes.segmentos.map((s) => (
              <option key={s} value={s}>
                {rotuloDoSegmento(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-pais`} className="text-xs text-muted-foreground">
            País
          </Label>
          <select
            id={`${idBase}-pais`}
            value={params.get("pais") ?? ""}
            onChange={(e) => aplicar("pais", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {opcoes.paises.map((p) => (
              <option key={p} value={p}>
                {nomeDoPais(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-estado`} className="text-xs text-muted-foreground">
            Estado
          </Label>
          <select
            id={`${idBase}-estado`}
            value={params.get("estado") ?? ""}
            onChange={(e) => aplicar("estado", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {opcoes.estados.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-cidade`} className="text-xs text-muted-foreground">
            Cidade
          </Label>
          <select
            id={`${idBase}-cidade`}
            value={params.get("cidade") ?? ""}
            onChange={(e) => aplicar("cidade", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            {opcoes.cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-score`} className="text-xs text-muted-foreground">
            Oportunidade
          </Label>
          <select
            id={`${idBase}-score`}
            value={params.get("scoreMin") ?? ""}
            onChange={(e) => aplicar("scoreMin", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            <option value="70">Alta (70+)</option>
            <option value="45">Média para cima (45+)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-canal`} className="text-xs text-muted-foreground">
            Canal
          </Label>
          <select
            id={`${idBase}-canal`}
            value={params.get("canal") ?? ""}
            onChange={(e) => aplicar("canal", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-fonte`} className="text-xs text-muted-foreground">
            Fonte
          </Label>
          <select
            id={`${idBase}-fonte`}
            value={params.get("fonte") ?? ""}
            onChange={(e) => aplicar("fonte", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            <option value="osm">OpenStreetMap</option>
            <option value="receita">Receita Federal</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-etapa`} className="text-xs text-muted-foreground">
            Etapa
          </Label>
          <select
            id={`${idBase}-etapa`}
            value={params.get("etapa") ?? ""}
            onChange={(e) => aplicar("etapa", e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            {ETAPAS.map((et) => (
              <option key={et} value={et}>
                {ROTULO_ETAPA[et]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { chave: "temSite", rotulo: "Tem site próprio" },
            { chave: "temEmail", rotulo: "Tem e-mail" },
            { chave: "temTelefone", rotulo: "Tem telefone" },
          ] as const
        ).map(({ chave, rotulo }) => (
          <fieldset key={chave} className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs text-muted-foreground">{rotulo}</legend>
            <div
              role="radiogroup"
              aria-label={rotulo}
              className="flex h-11 items-stretch overflow-hidden rounded-md border border-input"
            >
              {TRIPLICE.map((op) => {
                const atual = params.get(chave) ?? "";
                return (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={atual === op.valor}
                    onClick={() => aplicar(chave, op.valor)}
                    className={
                      atual === op.valor
                        ? "flex-1 cursor-pointer bg-primary px-2 text-sm font-medium text-primary-foreground"
                        : "flex-1 cursor-pointer px-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
                    }
                  >
                    {op.rotulo}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            aplicar("q", texto.trim());
          }}
        >
          <Label htmlFor={`${idBase}-q`} className="text-xs text-muted-foreground">
            Nome ou endereço
          </Label>
          <Input
            id={`${idBase}-q`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar e pressionar Enter"
            className="h-11"
            autoComplete="off"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="num text-sm text-muted-foreground">
          {pendente ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Filtrando…
            </span>
          ) : (
            <>
              <span className="font-medium text-foreground">{total.toLocaleString("pt-BR")}</span>{" "}
              {total === 1 ? "empresa" : "empresas"}
              {ativos > 0 && " com os filtros aplicados"}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          {ativos > 0 && (
            <Button
              variant="ghost"
              className="h-11 cursor-pointer gap-2 text-muted-foreground"
              onClick={() => iniciar(() => router.push("/empresas"))}
            >
              <X className="size-4" aria-hidden="true" />
              Limpar filtros
            </Button>
          )}

          {/* Link e não fetch: o navegador cuida do download, e o CSV sai
              com exatamente os filtros que estão na URL. */}
          <Button
            render={<a href={`/api/exportar?${params.toString()}`} />}
            nativeButton={false}
            variant="secondary"
            className="h-11 cursor-pointer gap-2"
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
