import { z } from "zod";

import { getBanco } from "@/db/cliente";
import { vendasPagasDoAno } from "@/db/painel";
import { obterIA } from "@/integrations/ai";
import { SaidaInvalida, validarTexto } from "@/integrations/ai/agentes/contexto";
import { gerarConferido } from "@/integrations/ai/agentes/gerar";
import type { EsquemaResposta } from "@/integrations/ai/tipos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { agrupar, janela, PERIODOS, type Periodo } from "@/lib/periodos";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";

/**
 * "Gerar resumo do período" do Início: a IA lê os números do período e
 * escreve um parágrafo e três próximos passos. Só números que o sistema
 * mediu entram no texto — a conferência barra qualquer outro.
 */
export const maxDuration = 60;

const Corpo = z.object({ periodo: z.enum(PERIODOS.map((p) => p.chave) as [Periodo, ...Periodo[]]) });

const ESQUEMA: EsquemaResposta = {
  type: "object",
  properties: {
    resumo: { type: "string", description: "2 a 4 frases sobre o período, em português do Brasil, falando com o Artur (você)." },
    proximos_passos: { type: "array", items: { type: "string" }, description: "Exatamente 3 ações concretas para os próximos dias." },
  },
  required: ["resumo", "proximos_passos"],
};

export const POST = rota(async (req) => {
  await limitar("resumo-periodo", 30, 3600);
  const { periodo } = await lerCorpo(req, Corpo);
  if (!(await obterIA().disponivel())) throw new ErroApi("A IA ainda não está configurada (chave do Gemini em Configurações → Integrações).", 409, "sem_configuracao");

  const banco = getBanco();
  const g = agrupar(await vendasPagasDoAno(), periodo);
  const { inicio } = janela(periodo);
  const desde = inicio.toISOString().slice(0, 19).replace("T", " ");
  const { rows } = await banco.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM leads WHERE criado_em >= ?) AS encontrados,
            (SELECT COUNT(*) FROM leads WHERE contatado_em >= ?) AS abordados,
            (SELECT COUNT(*) FROM leads WHERE respondeu_em >= ?) AS responderam,
            (SELECT COUNT(*) FROM leads l JOIN empresas e ON e.id = l.empresa_id
              WHERE l.contatado_em IS NULL AND e.nao_contatar = 0 AND l.etapa IN ('novo','qualificado')) AS para_abordar`,
    args: [desde, desde, desde],
  });
  const n = (k: string) => Number(rows[0]?.[k] ?? 0);
  const rotulo = PERIODOS.find((p) => p.chave === periodo)!.rotulo.toLowerCase();

  const fatos = [
    `Período: ${rotulo}`,
    `Receita: ${formatarDinheiro(g.receita)}`,
    `Lucro (receita menos custos registrados): ${formatarDinheiro(g.lucro)}`,
    `Vendas pagas: ${g.vendas}`,
    `Ticket médio: ${formatarDinheiro(g.ticket)}`,
    `Empresas encontradas no período: ${n("encontrados")}`,
    `Empresas abordadas no período: ${n("abordados")}`,
    `Empresas que responderam no período: ${n("responderam")}`,
    `Empresas ainda não abordadas na carteira: ${n("para_abordar")}`,
  ];
  if (g.variacaoLucro !== null) fatos.push(`Variação do lucro contra o período anterior: ${g.variacaoLucro}%`);
  const textoFatos = fatos.join("\n");
  const numeros = new Set<string>();
  for (const m of textoFatos.matchAll(/\d+(?:[.,]\d+)*/g)) numeros.add(m[0]);
  ["3", "7"].forEach((x) => numeros.add(x)); // "3 próximos passos", "7 dias"
  // Valores em R$ podem aparecer sem centavos ("R$ 1.200") — também valem.
  for (const v of [g.receita, g.lucro, g.ticket]) {
    const reais = Math.round(v / 100);
    numeros.add(String(reais)).add(reais.toLocaleString("pt-BR"));
  }

  const instrucao = `Você é o assistente comercial da Vynexa Dev (estúdio que cria sites, sistemas e aplicativos). Escreva um resumo curto do período para o dono, Artur.

FATOS (use somente estes números, exatamente como estão):
${textoFatos}

REGRAS
- Fale com ele em segunda pessoa ("você"), tom direto e encorajador, sem exagero.
- Não invente números, clientes, porcentagens nem metas que não estejam nos fatos.
- Os próximos passos devem ser ações práticas na própria ferramenta: mapear empresas no Radar, abordar as não abordadas, retomar quem não respondeu, enviar prévias, registrar vendas.
- Não fale de anúncios ou tráfego pago.`;

  try {
    const r = await gerarConferido(instrucao, ESQUEMA, (b) => {
      const bruto = b as { resumo?: string; proximos_passos?: string[] };
      const resumo = validarTexto(String(bruto.resumo ?? ""), { numeros, campo: "resumo", maximo: 900 });
      const passos = (bruto.proximos_passos ?? []).slice(0, 3).map((p, i) => validarTexto(String(p), { numeros, campo: `passo ${i + 1}`, minimo: 6, maximo: 220 }));
      if (passos.length === 0) throw new SaidaInvalida("sem próximos passos.");
      return { resumo, passos };
    });
    return json(r);
  } catch (erro) {
    if (erro instanceof SaidaInvalida) throw new ErroApi(erro.message, 422);
    throw erro;
  }
});
