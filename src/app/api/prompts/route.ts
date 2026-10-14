import { z } from "zod";

import { listarPrompts, salvarPrompt } from "@/db/prompts";
import { ErroIA, obterIA } from "@/integrations/ai";
import type { EsquemaResposta } from "@/integrations/ai/tipos";
import { ErroApi, json, lerCorpo, limitar, rota } from "@/server/api";

/**
 * Gerador de prompts: transforma uma ideia solta (ou um prompt fraco) num
 * pedido completo para o Claude Code — contexto, requisitos, restrições,
 * critérios de aceite e como verificar. Também salva e lista.
 */
export const maxDuration = 60;

const Corpo = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("gerar"),
    modo: z.enum(["ideia", "melhorar"]),
    formato: z.enum(["texto", "json"]),
    destino: z.enum(["claude-code", "geral"]).default("claude-code"),
    entrada: z.string().trim().min(10, "Escreva pelo menos uma frase.").max(8000),
  }),
  z.object({
    acao: z.literal("salvar"),
    titulo: z.string().trim().min(2).max(140),
    modo: z.enum(["ideia", "melhorar"]),
    formato: z.enum(["texto", "json"]),
    entrada: z.string().trim().max(8000),
    saida: z.string().trim().min(10).max(20000),
  }),
]);

const CONTEXTO_VYNEXA = `A Vynexa Dev é um estúdio de Manacapuru (AM) que cria sites, landing pages, sistemas e aplicativos para negócios locais (barbearias, academias, deliveries, lojas, salões, clínicas).
Stack padrão dos projetos: Next.js (App Router) com TypeScript, Tailwind CSS, Framer Motion para animação, deploy na Vercel; Supabase quando há banco de dados, login ou painel administrativo.
Os projetos precisam funcionar muito bem no celular, carregar rápido, ter textos em português do Brasil e botão de WhatsApp quando fizer sentido.`;

const REGRAS = `REGRAS DO PROMPT QUE VOCÊ VAI ESCREVER
- Escreva em português do Brasil, no imperativo, direto ao ponto.
- Nunca invente dados do negócio do cliente (endereço, telefone, preços, horários, depoimentos, números de clientes) nem características dele que a ideia não diz (ambiente, estilo da casa, público, tempo de mercado, diferenciais). Onde faltar, escreva um marcador no formato [PREENCHER: o que falta].
- Seja específico: nomes de seções, comportamento no celular, estados (carregando, vazio, erro), acessibilidade (contraste, foco visível, textos alternativos).
- Inclua como verificar o resultado (rodar o projeto, abrir no celular, testar o fluxo principal) e o que entregar no fim.
- Não peça para usar serviços pagos sem avisar o custo.
- Não escreva saudação nem explicação fora do prompt.`;

const PERGUNTAS = { type: "array", items: { type: "string" }, description: "Até 3 informações que faltam e que melhorariam o resultado. Vazio se não faltar nada." };

const ESQUEMA_TEXTO: EsquemaResposta = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título curto do prompt (até 8 palavras)." },
    prompt: { type: "string", description: "O prompt completo, em Markdown, com as seções: Contexto, Objetivo, Requisitos, Restrições, Critérios de aceite, Entrega e verificação." },
    perguntas: PERGUNTAS,
  },
  required: ["titulo", "prompt", "perguntas"],
};

const lista = (descricao: string) => ({ type: "array", items: { type: "string" }, description: descricao });

const ESQUEMA_JSON: EsquemaResposta = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título curto do prompt (até 8 palavras)." },
    prompt_json: {
      type: "object",
      properties: {
        papel: { type: "string", description: "Quem o assistente deve ser nesta tarefa." },
        objetivo: { type: "string" },
        contexto: { type: "string" },
        requisitos: lista("Itens objetivos do que construir ou mudar."),
        restricoes: lista("O que não fazer."),
        estilo_visual: { type: "string", description: "Direção visual, quando a tarefa tiver interface. Vazio se não tiver." },
        criterios_de_aceite: lista("Condições verificáveis para considerar pronto."),
        entregaveis: lista("O que entregar no fim."),
        verificacao: lista("Passos para testar."),
      },
      required: ["papel", "objetivo", "contexto", "requisitos", "restricoes", "estilo_visual", "criterios_de_aceite", "entregaveis", "verificacao"],
    },
    perguntas: PERGUNTAS,
  },
  required: ["titulo", "prompt_json", "perguntas"],
};

type Gerado = { titulo?: string; prompt?: string; prompt_json?: Record<string, unknown>; perguntas?: string[] };

export const GET = rota(async () => json({ prompts: await listarPrompts() }));

export const POST = rota(async (req) => {
  const c = await lerCorpo(req, Corpo);

  if (c.acao === "salvar") {
    const id = await salvarPrompt({ titulo: c.titulo, modo: c.modo, formato: c.formato, entrada: c.entrada, saida: c.saida });
    return json({ id }, 201);
  }

  await limitar("prompts-ia", 60, 3600);
  if (!(await obterIA().disponivel())) throw new ErroApi("A IA ainda não está configurada (chave do Gemini em Configurações → Integrações).", 409, "sem_configuracao");

  const tarefa =
    c.modo === "ideia"
      ? `Transforme a IDEIA abaixo num prompt completo e pronto para colar.`
      : `Reescreva o PROMPT abaixo para ficar completo e sem ambiguidade, mantendo a intenção original e tudo o que ele já especifica.`;
  const destino =
    c.destino === "claude-code"
      ? `O prompt será colado no Claude Code (assistente de programação que lê e edita o projeto, roda comandos e testa no navegador). Peça que ele leia o projeto antes, siga o código existente e verifique no navegador antes de dizer que terminou.\n\n${CONTEXTO_VYNEXA}`
      : `O prompt será usado em um assistente de IA qualquer. Não presuma acesso a arquivos ou terminal.`;

  const instrucao = `Você é especialista em escrever prompts para assistentes de IA.
${tarefa}

${destino}

${REGRAS}

${c.modo === "ideia" ? "IDEIA" : "PROMPT ORIGINAL"}:
"""
${c.entrada}
"""`;

  let bruto: Gerado | null = null;
  for (let i = 0; i < 2 && !bruto; i += 1) {
    try {
      bruto = await obterIA().gerarJson<Gerado>(instrucao, c.formato === "json" ? ESQUEMA_JSON : ESQUEMA_TEXTO);
    } catch (e) {
      if (e instanceof ErroIA && e.temporario && i === 0) {
        // Sobrecarga do Gemini costuma passar em segundos.
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      if (e instanceof ErroIA) throw new ErroApi(e.message, e.semConfiguracao ? 409 : 503);
      throw e;
    }
  }

  const saida = c.formato === "json" ? (bruto?.prompt_json ? JSON.stringify(bruto.prompt_json, null, 2) : "") : (bruto?.prompt ?? "").trim();
  if (saida.length < 80) throw new ErroApi("A IA devolveu um prompt vazio ou curto demais. Tente de novo.", 502);
  return json({
    titulo: (bruto?.titulo ?? "").trim().slice(0, 140) || "Prompt sem título",
    saida: saida.slice(0, 20000),
    perguntas: (bruto?.perguntas ?? []).filter((p) => typeof p === "string" && p.trim()).slice(0, 3),
  });
});
