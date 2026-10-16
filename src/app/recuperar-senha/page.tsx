import type { Metadata } from "next";
import Link from "next/link";

import { FormularioSenha } from "@/components/publico/formulario-senha";
import { MolduraAuth } from "@/components/publico/moldura-auth";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function PaginaRecuperarSenha() {
  return (
    <MolduraAuth
      frase="Acontece. Em um minuto você está de volta."
      titulo="Criar uma senha nova"
      subtitulo={
        <>
          Mandamos um link para o seu e-mail.{" "}
          <Link href="/login" className="font-semibold text-ciano underline-offset-2 hover:underline">
            Voltar para entrar
          </Link>
        </>
      }
    >
      <FormularioSenha modo="pedir" />
    </MolduraAuth>
  );
}
