import type { Metadata } from "next";
import { CircleAlert, CircleCheck } from "lucide-react";

import { FormularioAjustes } from "@/app/(painel)/ajustes/formulario-ajustes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { diagnosticarIntegracoes, lerConfiguracoes } from "@/db/configuracoes";

export const metadata: Metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default async function PaginaAjustes() {
  const [config, integracoes] = await Promise.all([
    lerConfiguracoes(),
    Promise.resolve(diagnosticarIntegracoes()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que dá para mudar sem republicar o site. Credenciais continuam em variável de ambiente.
        </p>
      </header>

      <FormularioAjustes valores={config} />

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
