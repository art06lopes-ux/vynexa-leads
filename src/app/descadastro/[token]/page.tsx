import { CircleCheck } from "lucide-react";

import { MonogramaProvisorio } from "@/components/marca";
import { getBanco } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";

import { confirmarDescadastro } from "./acao";

export const metadata = { title: "Não receber mais mensagens" };

/**
 * Página pública de descadastro (link no rodapé de todo e-mail).
 *
 * A confirmação é um botão, não a simples abertura do link: filtros de
 * spam e antivírus "clicam" em todos os links de um e-mail para checá-los,
 * e isso descadastraria todo mundo sem querer. O cabeçalho
 * List-Unsubscribe-Post (one-click do Gmail) vai direto para a ação.
 */
export default async function PaginaDescadastro({ params, searchParams }: PageProps<"/descadastro/[token]">) {
  const { token } = await params;
  const { feito } = await searchParams;
  const identidade = await lerIdentidade();
  const { rows } = /^[A-Za-z0-9_-]{16,40}$/.test(token)
    ? await getBanco().execute({ sql: `SELECT e.nome, e.nao_contatar FROM envios en JOIN leads l ON l.id = en.lead_id JOIN empresas e ON e.id = l.empresa_id WHERE en.token = ?`, args: [token] })
    : { rows: [] };
  const alvo = rows[0];
  const concluido = feito === "1" || Number(alvo?.nao_contatar) === 1;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8fafc] px-4 text-[#0f172a]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          {identidade.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={identidade.logoUrl} alt={identidade.empresa} className="h-9 w-auto" />
          ) : (
            <MonogramaProvisorio className="size-9" />
          )}
          <span className="font-semibold">{identidade.empresa}</span>
        </div>
        {!alvo ? (
          <p className="text-[#475569]">Este link não é válido ou expirou. Se quiser parar de receber mensagens, responda ao e-mail com “não”.</p>
        ) : concluido ? (
          <div>
            <CircleCheck className="mb-3 size-10 text-[#16a34a]" />
            <h1 className="text-xl font-semibold">Pronto.</h1>
            <p className="mt-2 text-[#475569]">{String(alvo.nome)} não vai receber mais mensagens nossas. Desculpe o incômodo.</p>
          </div>
        ) : (
          <form action={confirmarDescadastro}>
            <input type="hidden" name="token" value={token} />
            <h1 className="text-xl font-semibold">Não receber mais mensagens</h1>
            <p className="mt-2 text-[#475569]">Confirme e {String(alvo.nome)} sai da nossa lista de contato — por e-mail e por qualquer outro canal.</p>
            <button type="submit" className="mt-6 h-11 w-full cursor-pointer rounded-xl bg-[#0f172a] text-sm font-semibold text-white hover:bg-[#1e293b]">
              Confirmar
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
