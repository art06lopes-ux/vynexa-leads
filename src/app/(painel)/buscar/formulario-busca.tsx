"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Flame, LoaderCircle, Radar } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressoBusca } from "@/components/leads/progresso-busca";
import type { UF } from "@/lib/geo/ibge";
import { PAISES } from "@/lib/geo/paises";
import { SEGMENTOS } from "@/lib/osm/segmentos";
import { cn } from "@/lib/utils";

/** 0 = todas as mapeadas na região. É o padrão: teto é exceção, não regra. */
const QUANTIDADES = [0, 50, 100, 200] as const;
const PAISES_INTERNACIONAIS = PAISES.filter((p) => p.codigo !== "BR");

type Nicho = { slug: string; rotulo: string; total: number };

type Progresso = {
  status: "pendente" | "em_andamento" | "concluida" | "erro";
  rotulo: string | null;
  encontradas: number;
  novas: number;
  raioKm: number | null;
  expansoes: number;
  erro: string | null;
};

export function FormularioBusca({ estados, erroIbge }: { estados: UF[]; erroIbge: string | null }) {
  const router = useRouter();

  const [escopo, setEscopo] = useState<"br" | "intl">("br");
  const [uf, setUf] = useState("");
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);
  const [cidade, setCidade] = useState("");

  const [pais, setPais] = useState("US");
  const [regiaoIntl, setRegiaoIntl] = useState("");
  const [cidadeIntl, setCidadeIntl] = useState("");

  const [nichos, setNichos] = useState<Nicho[] | null>(null);
  const [carregandoNichos, setCarregandoNichos] = useState(false);
  const tokenNichos = useRef(0);

  const [segmento, setSegmento] = useState(SEGMENTOS[0]!.slug);
  const [tagChave, setTagChave] = useState("");
  const [tagValor, setTagValor] = useState("");

  const [alvo, setAlvo] = useState<number>(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);

  const idUf = useId();
  const idCidade = useId();
  const idPais = useId();
  const idSegmento = useId();

  // Guarda o timer do polling para poder cancelá-lo quando o componente
  // sai de cena — sem isso, sair da página deixa uma requisição a cada
  // 3 segundos rodando para sempre.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /**
   * Troca de estado: zera a cidade e recarrega os municípios.
   *
   * Feito aqui e não num `useEffect` de propósito. Carregar a lista é
   * consequência de um clique, não sincronização com sistema externo —
   * e `setState` síncrono dentro de efeito dispara renderização em
   * cascata (a regra `react-hooks/set-state-in-effect` reprova, com razão).
   *
   * O token descarta resposta fora de ordem: trocar MG por SP e o MG
   * responder depois deixaria a lista errada na tela sem ele.
   */
  const tokenMunicipios = useRef(0);

  async function trocarUf(novaUf: string) {
    setUf(novaUf);
    setCidade("");
    setMunicipios([]);

    if (novaUf === "") {
      setNichos(null);
      return;
    }

    const token = ++tokenMunicipios.current;
    setCarregandoMunicipios(true);

    try {
      const resposta = await fetch(`/api/geo/municipios?uf=${encodeURIComponent(novaUf)}`);
      if (!resposta.ok) throw new Error("falha");
      const dados = (await resposta.json()) as { municipios: string[] };
      if (token === tokenMunicipios.current) setMunicipios(dados.municipios);
    } catch {
      if (token === tokenMunicipios.current) {
        toast.error("Não consegui carregar os municípios do IBGE.");
      }
    } finally {
      if (token === tokenMunicipios.current) setCarregandoMunicipios(false);
    }

    void buscarNichos(novaUf, "");
  }

  /**
   * Ranking de nichos por quantidade de estabelecimentos da Receita na
   * região — para o operador ver qual segmento tem mais chance de dar
   * empresa antes de escolher e caçar. Só existe para o Brasil, porque só
   * o Brasil tem a base da Receita.
   */
  async function buscarNichos(ufAtual: string, cidadeAtual: string) {
    if (ufAtual === "") {
      setNichos(null);
      return;
    }

    const token = ++tokenNichos.current;
    setCarregandoNichos(true);

    try {
      const params = new URLSearchParams({ uf: ufAtual });
      if (cidadeAtual) params.set("cidade", cidadeAtual);
      const resposta = await fetch(`/api/receita/nichos?${params}`);
      if (!resposta.ok) throw new Error("falha");
      const dados = (await resposta.json()) as { nichos: Nicho[] };
      if (token === tokenNichos.current) setNichos(dados.nichos);
    } catch {
      if (token === tokenNichos.current) setNichos(null);
    } finally {
      if (token === tokenNichos.current) setCarregandoNichos(false);
    }
  }

  function acompanhar(buscaId: string) {
    async function verificar() {
      try {
        const resposta = await fetch(`/api/buscas/${buscaId}`, { cache: "no-store" });
        if (!resposta.ok) throw new Error("falha ao consultar");

        const dados = (await resposta.json()) as Progresso;
        setProgresso(dados);

        if (dados.status === "concluida") {
          setEnviando(false);
          toast.success(
            dados.novas === 0
              ? `${dados.encontradas} encontradas, todas já estavam na carteira.`
              : `${dados.novas} ${dados.novas === 1 ? "empresa nova" : "empresas novas"}.`,
          );
          // Atualiza os contadores do painel e a listagem sem recarregar.
          router.refresh();
          return;
        }

        if (dados.status === "erro") {
          setEnviando(false);
          setErro(dados.erro ?? "A busca falhou.");
          return;
        }

        timer.current = setTimeout(verificar, 3000);
      } catch {
        // Falha de rede no polling não é falha da busca: o worker segue
        // trabalhando. Tenta de novo, mais devagar.
        timer.current = setTimeout(verificar, 8000);
      }
    }

    timer.current = setTimeout(verificar, 2000);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setProgresso(null);

    const segmentoFinal =
      segmento === "__outro__" ? `custom:${tagChave.trim()}=${tagValor.trim()}` : segmento;

    if (segmento === "__outro__" && (tagChave.trim() === "" || tagValor.trim() === "")) {
      setErro("Informe a chave e o valor da tag do OpenStreetMap.");
      return;
    }

    const corpo =
      escopo === "br"
        ? { segmento: segmentoFinal, pais: "BR", estado: uf || null, cidade: cidade || null, alvo }
        : {
            segmento: segmentoFinal,
            pais,
            estado: regiaoIntl.trim() || null,
            cidade: cidadeIntl.trim() || null,
            alvo,
          };

    setEnviando(true);

    try {
      const resposta = await fetch("/api/buscas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const dados = (await resposta.json()) as { buscaId?: string; erro?: string };

      if (!resposta.ok || !dados.buscaId) {
        setEnviando(false);
        setErro(dados.erro ?? "Não consegui criar a busca.");
        return;
      }

      setProgresso({
        status: "pendente",
        rotulo: null,
        encontradas: 0,
        novas: 0,
        raioKm: null,
        expansoes: 0,
        erro: null,
      });
      acompanhar(dados.buscaId);
    } catch {
      setEnviando(false);
      setErro("Falha de rede ao criar a busca.");
    }
  }

  const classeCampo =
    "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm transition-colors duration-200 focus-visible:border-ring";

  return (
    <Card className="vidro">
      <CardContent className="pt-6">
        <form onSubmit={enviar} className="flex flex-col gap-5">
          {/* Escopo: dois botões e não um select. São duas opções, e a
              escolha troca o formulário inteiro — precisa estar visível. */}
          <div
            role="radiogroup"
            aria-label="Escopo da busca"
            className="flex w-full max-w-xs items-stretch overflow-hidden rounded-md border border-input"
          >
            {(["br", "intl"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={escopo === valor}
                onClick={() => setEscopo(valor)}
                className={cn(
                  "h-11 flex-1 cursor-pointer px-3 text-sm font-medium transition-colors duration-200",
                  escopo === valor
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {valor === "br" ? "Brasil" : "Internacional"}
              </button>
            ))}
          </div>

          {escopo === "br" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={idUf}>Estado</Label>
                <select
                  id={idUf}
                  value={uf}
                  onChange={(e) => void trocarUf(e.target.value)}
                  className={classeCampo}
                >
                  <option value="">Todo o Brasil</option>
                  {estados.map((e) => (
                    <option key={e.sigla} value={e.sigla}>
                      {e.nome}
                    </option>
                  ))}
                </select>
                {erroIbge && (
                  <p className="text-xs text-destructive">
                    Lista do IBGE indisponível: {erroIbge}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={idCidade}>Cidade</Label>
                <select
                  id={idCidade}
                  value={cidade}
                  onChange={(e) => {
                    setCidade(e.target.value);
                    void buscarNichos(uf, e.target.value);
                  }}
                  className={classeCampo}
                  disabled={uf === "" || carregandoMunicipios}
                >
                  <option value="">
                    {uf === ""
                      ? "Todos os municípios"
                      : carregandoMunicipios
                        ? "Carregando…"
                        : "Estado inteiro"}
                  </option>
                  {municipios.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Sem cidade, cobre o estado inteiro; sem estado, o Brasil inteiro pela base da
                  Receita Federal (interior incluído).
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor={idPais}>País</Label>
                <select
                  id={idPais}
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className={classeCampo}
                >
                  {PAISES_INTERNACIONAIS.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idPais}-regiao`}>Estado / região</Label>
                <Input
                  id={`${idPais}-regiao`}
                  value={regiaoIntl}
                  onChange={(e) => setRegiaoIntl(e.target.value)}
                  placeholder="Florida"
                  className="h-11"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idPais}-cidade`}>Cidade</Label>
                <Input
                  id={`${idPais}-cidade`}
                  value={cidadeIntl}
                  onChange={(e) => setCidadeIntl(e.target.value)}
                  placeholder="Orlando"
                  className="h-11"
                  autoComplete="off"
                />
              </div>

              <p className="text-xs text-muted-foreground sm:col-span-3">
                Fora do Brasil não existe fonte gratuita e universal de subdivisões, então estes
                dois campos são texto livre, resolvidos pelo Nominatim. Escreva no idioma local.
              </p>
            </div>
          )}

          {escopo === "br" && uf !== "" && (carregandoNichos || (nichos && nichos.length > 0)) && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Flame className="size-3.5 text-acento" aria-hidden="true" />
                Nichos com mais chance {cidade ? `em ${cidade}` : `em ${uf}`}
              </p>
              {carregandoNichos ? (
                <p className="text-xs text-muted-foreground">Consultando a base da Receita…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {nichos!.slice(0, 6).map((n) => (
                    <button
                      key={n.slug}
                      type="button"
                      onClick={() => setSegmento(n.slug)}
                      className={cn(
                        "num flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                        segmento === n.slug
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent text-muted-foreground hover:border-acento/40 hover:text-foreground",
                      )}
                    >
                      {n.rotulo}
                      <span className="opacity-70">{n.total}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Estabelecimentos ativos da Receita na região, por nicho. Mais estabelecimentos é
                mais chance de achar quem não tem site — não é garantia de venda.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={idSegmento}>Segmento</Label>
              <select
                id={idSegmento}
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                className={classeCampo}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.rotulo}
                  </option>
                ))}
                <option value="__outro__">Outro — tag do OpenStreetMap</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idSegmento}-qtd`}>Quantidade alvo</Label>
              <div
                id={`${idSegmento}-qtd`}
                role="radiogroup"
                aria-label="Quantidade alvo"
                className="flex h-11 items-stretch overflow-hidden rounded-md border border-input"
              >
                {QUANTIDADES.map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={alvo === valor}
                    onClick={() => setAlvo(valor)}
                    className={cn(
                      "num flex-1 cursor-pointer text-sm font-medium transition-colors duration-200",
                      alvo === valor
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {valor === 0 ? "Todas" : valor}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {alvo === 0
                  ? "Tudo o que existe na região, sem corte — mapa e, no Brasil, cadastro da Receita."
                  : "Teto por busca; abre o raio se vier pouco."}
              </p>
            </div>
          </div>

          {segmento === "__outro__" && (
            <div className="grid gap-4 rounded-lg border border-border bg-card/40 p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idSegmento}-chave`}>Chave da tag</Label>
                <Input
                  id={`${idSegmento}-chave`}
                  value={tagChave}
                  onChange={(e) => setTagChave(e.target.value)}
                  placeholder="shop"
                  className="h-11 font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idSegmento}-valor`}>Valor</Label>
                <Input
                  id={`${idSegmento}-valor`}
                  value={tagValor}
                  onChange={(e) => setTagValor(e.target.value)}
                  placeholder="bakery"
                  className="h-11 font-mono"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Consulte os valores possíveis em{" "}
                <a
                  href="https://wiki.openstreetmap.org/wiki/Map_features"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                >
                  Map features
                </a>{" "}
                no wiki do OpenStreetMap.
              </p>
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {erro}
            </p>
          )}

          {progresso && progresso.status !== "erro" && (
            <div aria-live="polite">
              <ProgressoBusca
                estagio={progresso.status === "concluida" ? "concluida" : progresso.status}
                local={progresso.rotulo}
                aviso={progresso.erro}
              />

              {progresso.status === "concluida" && (
                <dl className="num mt-3 flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-muted-foreground">
                  <div className="flex gap-1.5">
                    <dt>Encontradas:</dt>
                    <dd className="font-medium text-foreground">{progresso.encontradas}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Novas:</dt>
                    <dd className="font-medium text-emerald-300">{progresso.novas}</dd>
                  </div>
                  {progresso.expansoes > 0 && progresso.raioKm !== null && (
                    <div className="flex gap-1.5">
                      <dt>Raio final:</dt>
                      <dd className="font-medium text-foreground">{progresso.raioKm} km</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" disabled={enviando} className="h-11 min-w-44 cursor-pointer">
              {enviando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Caçando…
                </>
              ) : (
                <>
                  <Radar className="size-4" aria-hidden="true" />
                  Caçar empresas
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
