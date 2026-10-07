import type { Client, InStatement } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import { ErroEmail, provedorEmail, provedorEmailAtivo, ehProvedorEmail, type EmailProvider } from "@/integrations/email";
import { comporEmail, type Identidade } from "@/services/composicao-email";
import { eventoSql } from "@/services/eventos";
import { linksDeRastreio, novoToken, urlBase } from "@/services/rastreio";

/**
 * O envio de UM e-mail — usado pela fila de campanhas e pelo envio
 * avulso do perfil do lead.
 *
 * Antes de mandar: confere de novo `nao_contatar` (o contato pode ter
 * pedido para sair depois que a campanha foi montada) e se o envio
 * ainda está num estado que permite sair. Depois: grava o id do
 * provedor, move o lead para "abordado" se ainda estava antes disso e
 * registra no histórico.
 */

export type EnvioParaSair = {
  id: string;
  lead_id: string;
  campanha_id: string | null;
  passo: number;
  destinatario: string | null;
  assunto: string | null;
  corpo: string | null;
  token: string | null;
};

export async function carregarIdentidade(banco: Client): Promise<{ identidade: Identidade; base: string; config: Record<string, string> }> {
  const { rows } = await banco.execute(`SELECT chave, valor FROM configuracoes`);
  const c = Object.fromEntries(rows.map((r) => [String(r.chave), String(r.valor)]));
  const base = urlBase(c.app_url);
  return {
    base,
    config: c,
    identidade: {
      empresaNome: c.empresa_nome || "Vynexa Dev",
      responsavelNome: c.responsavel_nome || c.remetente_nome || "Artur",
      assinatura: c.email_assinatura || null,
      site: c.empresa_site || null,
      whatsapp: c.empresa_whatsapp || null,
      instagram: c.empresa_instagram || null,
      // Logo enviado pela tela vive no banco; o e-mail aponta para a rota
      // pública que o serve. Sem logo, nada de imagem.
      logoUrl: c.logo_data ? `${base}/api/marca/logo` : null,
      corPrimaria: c.cor_primaria || "#2f6bff",
    },
  };
}

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; erro: string; temporario: boolean; pulado?: boolean };

export async function enviarUm(banco: Client, envio: EnvioParaSair, provedor?: EmailProvider): Promise<ResultadoEnvio> {
  const { rows } = await banco.execute({
    sql: `SELECT e.nome, e.email, e.nao_contatar, e.idioma_abordagem, l.etapa
          FROM leads l JOIN empresas e ON e.id = l.empresa_id WHERE l.id = ?`,
    args: [envio.lead_id],
  });
  const alvo = rows[0];
  const instante = agora();

  const cancelar = async (motivo: string): Promise<ResultadoEnvio> => {
    await banco.execute({
      sql: `UPDATE envios SET status = 'cancelado', erro = ?, atualizado_em = ? WHERE id = ?`,
      args: [motivo, instante, envio.id],
    });
    return { ok: false, erro: motivo, temporario: false, pulado: true };
  };

  if (!alvo) return cancelar("Lead removido.");
  if (Number(alvo.nao_contatar) === 1) return cancelar("Contato pediu para não receber mensagens.");
  const para = envio.destinatario ?? (alvo.email ? String(alvo.email) : null);
  if (!para) return cancelar("Empresa sem e-mail.");
  if (!envio.assunto || !envio.corpo) return { ok: false, erro: "E-mail ainda não preparado.", temporario: true };

  // Follow-up de quem já respondeu (ou saiu do funil) não sai.
  if (envio.passo > 0 && ["respondeu", "negociacao", "proposta", "fechado", "perdido"].includes(String(alvo.etapa))) {
    return cancelar("Lead já respondeu ou saiu do funil — follow-up cancelado.");
  }

  // Trava contra envio duplo: só quem ganhar a troca para 'enviando' segue.
  const { rowsAffected } = await banco.execute({
    sql: `UPDATE envios SET status = 'enviando', atualizado_em = ? WHERE id = ? AND status IN ('preparado','agendado','erro')`,
    args: [instante, envio.id],
  });
  if (rowsAffected === 0) return { ok: false, erro: "Envio já processado por outra execução.", temporario: false, pulado: true };

  const { identidade, base, config } = await carregarIdentidade(banco);
  const token = envio.token ?? novoToken();
  const links = await linksDeRastreio(base, token);

  // Assina de antemão cada link que aparece no texto + assinatura.
  const urls = new Set<string>([...(`${envio.corpo}\n${identidade.assinatura ?? ""}\n${identidade.site ?? ""}`.match(/https?:\/\/[^\s<>"']+/g) ?? [])]);
  const assinados = new Map<string, string>();
  for (const u of urls) assinados.set(u, await links.rastrearLink(u));

  const { texto, html } = comporEmail(
    envio.corpo,
    identidade,
    { pixel: links.pixel, descadastro: links.descadastro, rastrearLink: (u) => assinados.get(u) ?? u },
    String(alvo.idioma_abordagem ?? "pt-BR"),
  );

  const p = provedor ?? (ehProvedorEmail(config.email_provedor) ? provedorEmail(config.email_provedor) : await provedorEmailAtivo());

  try {
    const { id } = await p.enviar({
      para,
      assunto: envio.assunto,
      texto,
      html,
      remetenteNome: `${identidade.responsavelNome} · ${identidade.empresaNome}`,
      responderPara: config.email_resposta || null,
      cabecalhos: {
        "List-Unsubscribe": `<${links.descadastro}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    const depois = agora();
    const statements: InStatement[] = [
      {
        sql: `UPDATE envios SET status = 'enviado', destinatario = ?, provedor = ?, provedor_message_id = ?, token = ?,
                                enviado_em = ?, tentativas = tentativas + 1, erro = NULL, atualizado_em = ? WHERE id = ?`,
        args: [para, p.nome, id, token, depois, depois, envio.id],
      },
      {
        sql: `UPDATE leads SET etapa = CASE WHEN etapa IN ('novo','qualificado') THEN 'abordado' ELSE etapa END,
                               etapa_em = CASE WHEN etapa IN ('novo','qualificado') THEN ? ELSE etapa_em END,
                               contatado_em = COALESCE(contatado_em, ?), atualizado_em = ?
              WHERE id = ?`,
        args: [depois, depois, depois, envio.lead_id],
      },
      eventoSql(envio.lead_id, "email_enviado", `${envio.passo > 0 ? `Follow-up ${envio.passo}` : "E-mail"} enviado: "${envio.assunto}"`, { envioId: envio.id, provedor: p.nome }),
    ];
    if (envio.campanha_id) {
      statements.push({ sql: `UPDATE campanhas SET enviados = enviados + 1, atualizado_em = ? WHERE id = ?`, args: [depois, envio.campanha_id] });
      // Os follow-ups deste lead começam a contar a partir de agora.
      if (envio.passo === 0) {
        statements.push({
          sql: `UPDATE envios
                SET status = 'agendado',
                    agendado_para = datetime(?, '+' || CAST(json_extract(
                      (SELECT followup_dias FROM campanhas WHERE id = ?), '$[' || (passo - 1) || ']') AS TEXT) || ' days'),
                    atualizado_em = ?
                WHERE campanha_id = ? AND lead_id = ? AND passo > 0 AND status = 'preparado'`,
          args: [depois, envio.campanha_id, depois, envio.campanha_id, envio.lead_id],
        });
      }
    }
    await banco.batch(statements, "write");
    return { ok: true, id };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const temporario = erro instanceof ErroEmail && erro.temporario;
    await banco.execute({
      sql: `UPDATE envios SET status = ?, erro = ?, tentativas = tentativas + 1, atualizado_em = ? WHERE id = ?`,
      // Temporário volta para a fila; definitivo fica como erro.
      args: [temporario ? "agendado" : "erro", mensagem.slice(0, 500), agora(), envio.id],
    });
    if (!temporario && envio.campanha_id) {
      await banco.execute({ sql: `UPDATE campanhas SET falhas = falhas + 1 WHERE id = ?`, args: [envio.campanha_id] });
    }
    return { ok: false, erro: mensagem, temporario };
  }
}

/** Envio avulso, do perfil do lead. Cria o envio e manda na hora. */
export async function enviarAvulso(banco: Client, leadId: string, assunto: string, corpo: string, para: string | null): Promise<ResultadoEnvio> {
  if (/[\r\n]/.test(assunto)) return { ok: false, erro: "O assunto não pode ter quebra de linha.", temporario: false };
  const id = novoId();
  const instante = agora();
  await banco.execute({
    sql: `INSERT INTO envios (id, campanha_id, lead_id, canal, passo, destinatario, assunto, corpo, status, token, gerado_em, criado_em, atualizado_em)
          VALUES (?, NULL, ?, 'email', 0, ?, ?, ?, 'preparado', ?, ?, ?, ?)`,
    args: [id, leadId, para, assunto.trim(), corpo.trim(), novoToken(), instante, instante, instante],
  });
  const { rows } = await banco.execute({ sql: `SELECT * FROM envios WHERE id = ?`, args: [id] });
  return enviarUm(banco, rows[0] as unknown as EnvioParaSair);
}
