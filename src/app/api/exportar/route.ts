import { listarEmpresasParaExportar, type Filtros } from "@/db/consultas";
import { gerarCsv } from "@/lib/leads/csv";
import { formatarTelefone, normalizarTelefone } from "@/lib/leads/whatsapp";
import { nomeDoPais } from "@/lib/geo/paises";
import { rotuloDoSegmento } from "@/lib/osm/segmentos";
import { ROTULO_STATUS_SITE } from "@/db/tipos";
import { exigirSessaoNaApi } from "@/server/sessao";

/** Lê os mesmos filtros da listagem, para exportar exatamente o que está na tela. */
export function filtrosDaUrl(params: URLSearchParams): Filtros {
  const booleano = (chave: string): boolean | undefined => {
    const v = params.get(chave);
    if (v === "sim") return true;
    if (v === "nao") return false;
    return undefined;
  };

  // `Number(null)` é 0, e 0 é finito: sem esta guarda, um CSV sem filtro
  // aplicaria `score >= 0` e descartaria em silêncio toda empresa ainda
  // não analisada, que é justamente a maioria.
  const numero = (chave: string | null): number | undefined => {
    if (chave === null || chave.trim() === "") return undefined;
    const n = Number(chave);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    segmento: params.get("segmento") ?? undefined,
    pais: params.get("pais") ?? undefined,
    estado: params.get("estado") ?? undefined,
    cidade: params.get("cidade") ?? undefined,
    temSite: booleano("temSite"),
    temEmail: booleano("temEmail"),
    temTelefone: booleano("temTelefone"),
    scoreMin: numero(params.get("scoreMin")),
    fonte:
      params.get("fonte") === "osm" ? "osm" : params.get("fonte") === "receita" ? "receita" : undefined,
    canal:
      params.get("canal") === "whatsapp"
        ? "whatsapp"
        : params.get("canal") === "email"
          ? "email"
          : undefined,
    busca: params.get("q") ?? undefined,
  };
}

const CABECALHOS = [
  "Nome",
  "Segmento",
  "País",
  "Estado",
  "Cidade",
  "Endereço",
  "Telefone",
  "WhatsApp (E.164)",
  "E-mail",
  "Origem do e-mail",
  "Website",
  "Instagram",
  "Facebook",
  "Presença digital",
  "Score",
  "Motivo",
  "Mensagem gerada",
  "Canal",
  "Status do lead",
  "Idioma",
  "Fonte",
  "CNPJ",
  "Origem do telefone",
  "Fonte (link ou CNPJ)",
  "Adicionado em",
];

export async function GET(request: Request) {
  const naoAutenticado = await exigirSessaoNaApi();
  if (naoAutenticado) return naoAutenticado;

  const filtros = filtrosDaUrl(new URL(request.url).searchParams);
  const empresas = await listarEmpresasParaExportar(filtros);

  const linhas = empresas.map((e) => [
    e.nome,
    rotuloDoSegmento(e.categoria),
    nomeDoPais(e.pais),
    e.estado,
    e.cidade,
    e.endereco,
    formatarTelefone(e.telefone, e.pais),
    // A coluna crua em E.164 existe para quem for importar num
    // discador ou numa planilha de disparo; a formatada é para ler.
    normalizarTelefone(e.telefone, e.pais),
    e.email,
    e.email_origem,
    e.website,
    e.instagram,
    e.facebook,
    ROTULO_STATUS_SITE[e.status_site],
    e.score_oportunidade,
    e.motivo_problema,
    e.mensagem_gerada,
    e.canal_recomendado,
    e.status_lead,
    e.idioma_abordagem,
    e.fonte === "receita" ? "Receita Federal" : "OpenStreetMap",
    e.cnpj,
    e.telefone_origem,
    e.osm_id ? `https://www.openstreetmap.org/${e.osm_id}` : e.cnpj,
    e.criado_em,
  ]);

  const hoje = new Date().toISOString().slice(0, 10);

  return new Response(gerarCsv(CABECALHOS, linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vynexa-leads-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
