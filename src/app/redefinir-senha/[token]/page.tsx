import type { Metadata } from "next";

import { FormularioSenha } from "@/components/publico/formulario-senha";
import { MolduraAuth } from "@/components/publico/moldura-auth";

export const metadata: Metadata = { title: "Senha nova", robots: { index: false } };

export default async function PaginaRedefinirSenha({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  return (
    <MolduraAuth frase="Senha nova, mesma carteira de leads." titulo="Escolha a senha nova" subtitulo="Depois de salvar, você já entra direto.">
      <FormularioSenha modo="redefinir" token={token} />
    </MolduraAuth>
  );
}
