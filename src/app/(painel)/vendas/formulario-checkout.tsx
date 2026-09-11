"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, LoaderCircle, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Gera o link de checkout.
 *
 * Não existe campo de cartão aqui, e não vai existir: o cliente é levado
 * à página da Stripe, que é certificada para isso. Esta tela só descreve
 * o que está sendo cobrado.
 */
export function FormularioCheckout() {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const idBase = useId();

  async function gerar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setLink(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: descricao.trim(),
          valor: valor.trim(),
          moeda: "BRL",
          clienteEmail: email.trim() || null,
        }),
      });

      const dados = (await resposta.json()) as { url?: string; erro?: string };

      if (!resposta.ok || !dados.url) {
        setErro(dados.erro ?? "Não consegui gerar o link.");
        return;
      }

      setLink(dados.url);
      toast.success("Link gerado. Mande para o cliente.");
      router.refresh();
    } catch {
      setErro("Falha de rede ao gerar o link.");
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o link e copie à mão.");
    }
  }

  return (
    <Card className="vidro">
      <CardHeader>
        <CardTitle className="text-base">Gerar link de cobrança</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={gerar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-desc`}>O que está sendo cobrado</Label>
            <Input
              id={`${idBase}-desc`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Site institucional — Barbearia do João"
              maxLength={200}
              required
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Este texto aparece na página de pagamento do cliente.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-valor`}>Valor</Label>
              <Input
                id={`${idBase}-valor`}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="1.297,00"
                inputMode="decimal"
                required
                className="num h-11"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-email`}>E-mail do cliente</Label>
              <Input
                id={`${idBase}-email`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="opcional"
                className="h-11"
              />
            </div>
          </div>

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {erro}
            </p>
          )}

          {link && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/8 p-3">
              <p className="text-xs font-medium">Link pronto</p>
              {/* `break-all` porque a URL da Stripe é longuíssima e sem
                  isso estoura a largura do cartão. */}
              <p className="break-all text-xs text-muted-foreground">{link}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={copiar}
                  variant="secondary"
                  className="h-10 cursor-pointer gap-2"
                >
                  {copiado ? (
                    <>
                      <Check className="size-4 text-emerald-300" aria-hidden="true" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      Copiar link
                    </>
                  )}
                </Button>
                <Button
                  render={<a href={link} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                  variant="ghost"
                  className="h-10 cursor-pointer gap-2 text-muted-foreground"
                >
                  Abrir
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" disabled={enviando} className="h-11 cursor-pointer gap-2">
            {enviando ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Gerando…
              </>
            ) : (
              <>
                <Link2 className="size-4" aria-hidden="true" />
                Gerar link
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
