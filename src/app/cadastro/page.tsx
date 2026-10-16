import type { Metadata } from "next";
import Link from "next/link";

import { FormularioCadastro } from "@/components/publico/formulario-cadastro";
import { MolduraAuth } from "@/components/publico/moldura-auth";
import type { IdPlano } from "@/lib/planos";
import { diasDeTeste, listarPlanos } from "@/services/contas";

export const metadata: Metadata = { title: "Criar conta", description: "Comece o teste grátis do Vynexa Leads." };

export default async function PaginaCadastro({ searchParams }: PageProps<"/cadastro">) {
  const sp = await searchParams;
  const plano = (typeof sp.plano === "string" && ["essencial", "pro", "agencia"].includes(sp.plano) ? sp.plano : "pro") as IdPlano;
  const origem = typeof sp.origem === "string" ? sp.origem.slice(0, 40) : typeof sp.utm_source === "string" ? sp.utm_source.slice(0, 40) : "";
  const [planos, dias] = await Promise.all([listarPlanos(), diasDeTeste().catch(() => 7)]);

  return (
    <MolduraAuth
      frase="Sua próxima venda de site está a uma busca de distância."
      titulo={dias > 0 ? `Comece com ${dias} dias grátis` : "Crie sua conta"}
      subtitulo={
        <>
          Sem cartão para testar. Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-ciano underline-offset-2 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <FormularioCadastro planos={planos.map((p) => ({ id: p.id, nome: p.nome, precoCentavos: p.precoCentavos, destaque: p.destaque }))} planoInicial={plano} origem={origem} />
    </MolduraAuth>
  );
}
