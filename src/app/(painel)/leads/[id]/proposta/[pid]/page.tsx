import { notFound } from "next/navigation";

import { MonogramaProvisorio } from "@/components/marca";
import { BotaoImprimir } from "@/components/perfil/imprimir";
import { getBanco } from "@/db/cliente";
import { obterLead } from "@/db/leads";
import { lerIdentidade } from "@/db/painel";
import type { ConteudoProposta } from "@/integrations/ai/agentes/proposal-generator";
import { dataCurta } from "@/lib/datas";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

export const metadata = { title: "Proposta" };

/**
 * A proposta como documento: fundo branco, logo da Vynexa, pronta para
 * "Imprimir → Salvar como PDF". O preço vem do catálogo ou do vendedor —
 * nunca da IA.
 */
export default async function PaginaProposta({ params }: PageProps<"/leads/[id]/proposta/[pid]">) {
  const { id, pid } = await params;
  const [lead, identidade, { rows }] = await Promise.all([
    obterLead(id),
    lerIdentidade(),
    getBanco().execute({ sql: `SELECT * FROM propostas WHERE id = ? AND lead_id = ?`, args: [pid, id] }),
  ]);
  const p = rows[0];
  if (!lead || !p) notFound();
  const c = JSON.parse(String(p.conteudo)) as ConteudoProposta;
  const cfg = identidade.config;

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-[#0f172a] shadow-2xl print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 pb-6" style={{ borderColor: cfg.cor_primaria || "#3366ff" }}>
          <div className="flex items-center gap-3">
            {identidade.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identidade.logoUrl} alt={identidade.empresa} className="h-10 w-auto" />
            ) : (
              <MonogramaProvisorio className="size-10" />
            )}
            <div>
              <p className="font-display text-lg font-semibold">{identidade.empresa}</p>
              {cfg.empresa_site && <p className="text-xs text-[#64748b]">{cfg.empresa_site}</p>}
            </div>
          </div>
          <div className="text-right text-xs text-[#64748b]">
            <p>Proposta comercial</p>
            <p>{dataCurta(String(p.criado_em), cfg.fuso || undefined)}</p>
          </div>
        </header>

        <h1 className="mt-8 font-display text-2xl font-semibold">{c.titulo}</h1>
        <p className="mt-1 text-sm text-[#64748b]">Para: {lead.empresa.nome}</p>

        {[
          ["Contexto", c.contexto],
          ["O que observamos", c.problema],
          ["Nossa proposta", c.solucao],
        ].map(([t, texto]) => (
          <section key={t} className="mt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: cfg.cor_primaria || "#3366ff" }}>
              {t}
            </h2>
            <p className="mt-2 leading-relaxed">{texto}</p>
          </section>
        ))}

        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: cfg.cor_primaria || "#3366ff" }}>
            O que está incluído
          </h2>
          <ul className="mt-2 space-y-1.5">
            {c.entregaveis.map((e) => (
              <li key={e} className="flex gap-2">
                <span style={{ color: cfg.cor_primaria || "#3366ff" }}>✓</span> {e}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-7 rounded-xl bg-[#f1f5f9] p-5">
          <p className="text-sm text-[#64748b]">Investimento</p>
          <p className="font-display text-3xl font-semibold">{p.valor_centavos ? formatarDinheiro(Number(p.valor_centavos)) : "A combinar"}</p>
        </section>

        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: cfg.cor_primaria || "#3366ff" }}>
            Próximos passos
          </h2>
          <ol className="mt-2 list-inside list-decimal space-y-1.5">
            {c.proximosPassos.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <footer className="mt-10 border-t pt-5 text-sm text-[#475569]">
          <p className="font-semibold text-[#0f172a]">{identidade.responsavel}</p>
          <p>{identidade.empresa}</p>
          {cfg.empresa_whatsapp && <p>WhatsApp: {cfg.empresa_whatsapp}</p>}
          {cfg.empresa_email && <p>{cfg.empresa_email}</p>}
        </footer>
      </article>
    </div>
  );
}
