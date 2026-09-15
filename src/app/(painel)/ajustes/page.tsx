import type { Metadata } from "next";
import { CircleAlert, CircleCheck } from "lucide-react";

import { FormularioAjustes } from "@/app/(painel)/ajustes/formulario-ajustes";
import { BotaoNotificacoes } from "@/components/painel/botao-notificacoes";
import { ConexaoGoogle } from "@/components/painel/conexao-google";
import { contaConectada } from "@/lib/google/oauth";
import { CabecalhoPagina } from "@/components/painel/cabecalho-pagina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { diagnosticarIntegracoes, lerConfiguracoes } from "@/db/configuracoes";

export const metadata: Metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default async function PaginaAjustes({ searchParams }: PageProps<"/ajustes">) {
  const sp = await searchParams;
  const [config, integracoes, conta] = await Promise.all([
    lerConfiguracoes(),
    diagnosticarIntegracoes(),
    contaConectada(),
  ]);
  const avisoGoogle = typeof sp.msg === "string" ? sp.msg : null;
  const googleOk = sp.google === "ok";

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        olho="Sistema"
        titulo="Ajustes"
        descricao="O que dá para mudar sem republicar o site. Credenciais continuam em variável de ambiente."
      />

      <FormularioAjustes valores={config} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail para campanhas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {avisoGoogle && (
            <p
              className={
                googleOk
                  ? "rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200"
                  : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {avisoGoogle}
            </p>
          )}
          <ConexaoGoogle conta={conta} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações no celular</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Aviso na tela de bloqueio a cada venda — manual ou pela Stripe. Ative em cada aparelho
            que quiser receber. No iPhone, primeiro adicione o site à Tela de Início pelo Safari.
          </p>
          <BotaoNotificacoes />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {integracoes.map((i) => (
              <li key={i.nome} className="flex items-start gap-3 py-3">
                {/* Ícone e palavra, nunca só a cor: "ligada" e "faltando"
                    precisam ser legíveis sem distinguir verde de âmbar. */}
                {i.ligada ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.nome}{" "}
                    <span className={i.ligada ? "text-emerald-300" : "text-amber-300"}>
                      · {i.ligada ? "configurada" : "faltando"}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{i.detalhe}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
            Esta tela mostra apenas <strong>se</strong> cada variável existe — nunca o valor dela.
            Uma tela de ajustes que exibisse credenciais seria um vazamento com aparência de
            funcionalidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
