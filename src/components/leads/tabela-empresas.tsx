import { AtSign, ExternalLink, MapPin, MessageCircle, Phone, PhoneOff } from "lucide-react";

import { AcaoLead, BadgeScore } from "@/components/leads/acao-lead";
import { BadgeStatusSite } from "@/components/leads/badge-status-site";
import type { EmpresaListada } from "@/db/consultas";
import { nomeDoPais } from "@/lib/geo/paises";
import { CaixaSelecao } from "@/components/leads/selecao-campanha";
import { formatarTelefone, montarLinkWhatsApp } from "@/lib/leads/whatsapp";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";

function local(e: EmpresaListada): string {
  return [e.cidade, e.estado, nomeDoPais(e.pais)].filter(Boolean).join(", ");
}

/** Aviso explícito em vez de célula vazia: o operador precisa saber que falta buscar por fora. */
function SemDado({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-300/90">
      <PhoneOff className="size-3.5" aria-hidden="true" />
      {texto}
    </span>
  );
}

export function TabelaEmpresas({ empresas }: { empresas: EmpresaListada[] }) {
  return (
    <>
      {/* Tabela no desktop. O wrapper com overflow-x é o que impede a
          página inteira de rolar na horizontal quando a tela encolhe. */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <span className="sr-only">Selecionar</span>
              </th>
              <th scope="col" className="px-4 py-3 font-medium">Empresa</th>
              <th scope="col" className="px-4 py-3 font-medium">Segmento</th>
              <th scope="col" className="px-4 py-3 font-medium">Local</th>
              <th scope="col" className="px-4 py-3 font-medium">Contato</th>
              <th scope="col" className="px-4 py-3 font-medium">Presença</th>
              <th scope="col" className="px-4 py-3 font-medium">Oportunidade</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Links</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {empresas.map((e) => {
              const telefone = formatarTelefone(e.telefone, e.pais);
              // wa.me direto na linha, com a mensagem da IA se já existir.
              // Sem mensagem, abre a conversa vazia — melhor que esconder o
              // botão de quem só quer o número.
              const linkZap = montarLinkWhatsApp(e.telefone, e.mensagem_gerada ?? "", e.pais);

              return (
                <tr key={e.id} className="transition-colors duration-200 hover:bg-accent/40">
                  <td className="px-3 py-3 align-middle">
                    <CaixaSelecao id={e.id} nome={e.nome} temEmail={Boolean(e.email)} />
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <p className="truncate font-medium">{e.nome}</p>
                    {e.endereco && (
                      <p className="truncate text-xs text-muted-foreground">{e.endereco}</p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {rotuloDoSegmento(e.categoria)}
                  </td>

                  <td className="max-w-48 truncate px-4 py-3 text-muted-foreground">{local(e)}</td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {telefone ? (
                        <span className="num inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          {telefone}
                        </span>
                      ) : (
                        <SemDado texto="Sem telefone" />
                      )}

                      {e.email && (
                        <a
                          href={`mailto:${e.email}`}
                          className="inline-flex max-w-56 cursor-pointer items-center gap-1.5 truncate text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
                        >
                          <AtSign className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{e.email}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <BadgeStatusSite status={e.status_site} />
                  </td>

                  <td className="px-4 py-3">
                    <BadgeScore score={e.score_oportunidade} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {linkZap && (
                        <a
                          href={linkZap}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`WhatsApp · ${telefone ?? ""}`}
                          className="flex size-11 cursor-pointer items-center justify-center rounded-md text-emerald-300 transition-colors duration-200 hover:bg-emerald-400/10"
                        >
                          <MessageCircle className="size-4" aria-hidden="true" />
                          <span className="sr-only">Abrir WhatsApp de {e.nome}</span>
                        </a>
                      )}

                      <AcaoLead empresa={e} />

                      {e.website && (
                        <a
                          href={e.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={e.website}
                          className="flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                          <span className="sr-only">Abrir o site de {e.nome}</span>
                        </a>
                      )}
                      <a
                        href={`https://www.openstreetmap.org/${e.osm_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
                      >
                        <MapPin className="size-4" aria-hidden="true" />
                        <span className="sr-only">Ver {e.nome} no OpenStreetMap</span>
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No celular a mesma informação vira cartões: uma tabela de seis
          colunas em 375px é ilegível por mais que role. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {empresas.map((e) => {
          const telefone = formatarTelefone(e.telefone, e.pais);
          const linkZap = montarLinkWhatsApp(e.telefone, e.mensagem_gerada ?? "", e.pais);

          return (
            <li key={e.id} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1">
                    <CaixaSelecao id={e.id} nome={e.nome} temEmail={Boolean(e.email)} />
                  </span>
                  <div className="min-w-0">
                  <p className="truncate font-medium">{e.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {rotuloDoSegmento(e.categoria)} · {local(e)}
                  </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <BadgeStatusSite status={e.status_site} />
                  <BadgeScore score={e.score_oportunidade} />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5 text-sm">
                {telefone ? (
                  <span className="num inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {telefone}
                  </span>
                ) : (
                  <SemDado texto="Sem telefone no OpenStreetMap" />
                )}

                {e.email && (
                  <a
                    href={`mailto:${e.email}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 truncate text-muted-foreground"
                  >
                    <AtSign className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{e.email}</span>
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {linkZap && (
                  <a
                    href={linkZap}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-emerald-300"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                )}
                <AcaoLead empresa={e} />

                {e.website && (
                  <a
                    href={e.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Site
                  </a>
                )}
                <a
                  href={`https://www.openstreetmap.org/${e.osm_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground"
                >
                  <MapPin className="size-3.5" aria-hidden="true" />
                  OpenStreetMap
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
