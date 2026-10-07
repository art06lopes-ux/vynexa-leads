import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import { ErroIA } from "@/integrations/ai";
import { gerarEmail } from "@/integrations/ai/agentes/email-generator";
import { gerarFollowUps } from "@/integrations/ai/agentes/followup-generator";
import { notificar } from "@/integrations/notificacoes";
import { ehProvedorEmail, provedorEmail } from "@/integrations/email";
import { concluirSeTerminou } from "@/services/campanhas";
import { enviarUm, type EnvioParaSair } from "@/services/envio";
import { carregarDados, carregarRemetente } from "@/services/inteligencia";

/**
 * Fila de campanhas: preparar (IA escreve) e enviar (no ritmo).
 */

export type PayloadCampanhaV2 = { campanhaId: string };

const ORCAMENTO_MS = 3 * 60 * 1000;

/** Teto global por dia, somando todas as campanhas (reputação do remetente). */
async function tetoGlobal(banco: Client): Promise<number> {
  const { rows } = await banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'email_teto_diario'`);
  const n = Number(rows[0]?.valor ?? 100);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : 100;
}

// ---------------------------------------------------------------------
// Preparar
// ---------------------------------------------------------------------

export async function processarPreparo(banco: Client, p: PayloadCampanhaV2): Promise<string> {
  const inicio = Date.now();
  const { rows: cr } = await banco.execute({ sql: `SELECT * FROM campanhas WHERE id = ?`, args: [p.campanhaId] });
  const campanha = cr[0];
  if (!campanha) return "campanha removida";
  if (campanha.status === "cancelada") return "campanha cancelada";

  const dias: number[] = campanha.followup_dias ? (JSON.parse(String(campanha.followup_dias)) as number[]) : [];
  const remetente = await carregarRemetente(banco);

  // Um lead por vez: e-mail principal + follow-ups do mesmo lead juntos.
  const { rows: leads } = await banco.execute({
    sql: `SELECT DISTINCT lead_id FROM envios WHERE campanha_id = ? AND status = 'pendente' LIMIT 40`,
    args: [p.campanhaId],
  });

  let preparados = 0;
  let falhas = 0;
  for (const linha of leads) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    const leadId = String(linha.lead_id);
    try {
      const { dados, lead } = await carregarDados(banco, leadId);

      // Reaproveita um e-mail gerado nos últimos 7 dias pelo perfil do lead.
      const { rows: salvo } = await banco.execute({
        sql: `SELECT assunto, corpo FROM mensagens WHERE lead_id = ? AND tipo = 'email' AND criado_em >= datetime('now', '-7 days')
              ORDER BY criado_em DESC LIMIT 1`,
        args: [leadId],
      });
      let argumento: string | null = null;
      let cta: string | null = null;
      try {
        const a = lead.analise ? JSON.parse(lead.analise) : null;
        argumento = a?.oportunidade?.argumento ?? null;
        cta = a?.oportunidade?.cta ?? null;
      } catch {
        /* sem análise */
      }
      const principal = salvo[0]?.corpo
        ? { assunto: String(salvo[0].assunto), corpo: String(salvo[0].corpo) }
        : await gerarEmail(dados, remetente, argumento, cta);

      const instante = agora();
      await banco.execute({
        sql: `UPDATE envios SET assunto = ?, corpo = ?, status = 'preparado', gerado_em = ?, erro = NULL, atualizado_em = ?
              WHERE campanha_id = ? AND lead_id = ? AND passo = 0 AND status = 'pendente'`,
        args: [principal.assunto, principal.corpo, instante, instante, p.campanhaId, leadId],
      });

      if (dias.length > 0) {
        const follows = await gerarFollowUps(dados, remetente, principal, dias);
        for (let i = 0; i < follows.length; i += 1) {
          await banco.execute({
            sql: `UPDATE envios SET assunto = ?, corpo = ?, status = 'preparado', gerado_em = ?, erro = NULL, atualizado_em = ?
                  WHERE campanha_id = ? AND lead_id = ? AND passo = ? AND status = 'pendente'`,
            args: [follows[i].assunto, follows[i].corpo, instante, instante, p.campanhaId, leadId, i + 1],
          });
        }
      }
      preparados += 1;
    } catch (erro) {
      if (erro instanceof ErroIA && erro.temporario) {
        if (preparados === 0) throw erro; // devolve o job para mais tarde
        break;
      }
      falhas += 1;
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      // Sem IA ou com saída rejeitada: o envio fica em "erro" com o
      // motivo, e o operador pode escrever o texto à mão no preview.
      await banco.execute({
        sql: `UPDATE envios SET status = 'erro', erro = ?, atualizado_em = ? WHERE campanha_id = ? AND lead_id = ? AND status = 'pendente'`,
        args: [`Não foi possível gerar o texto: ${mensagem}`.slice(0, 500), agora(), p.campanhaId, leadId],
      });
      if (erro instanceof ErroIA && erro.semConfiguracao) {
        await banco.execute({
          sql: `UPDATE envios SET status = 'erro', erro = ?, atualizado_em = ? WHERE campanha_id = ? AND status = 'pendente'`,
          args: ["A IA não está configurada — escreva o texto no preview ou configure a IA.", agora(), p.campanhaId],
        });
        break;
      }
    }
  }

  const { rows: resto } = await banco.execute({
    sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND status = 'pendente'`,
    args: [p.campanhaId],
  });
  const faltam = Number(resto[0]?.n ?? 0);

  if (faltam > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'preparar_campanha', ?, 'pendente')`,
      args: [novoId(), JSON.stringify(p)],
    });
  } else {
    await banco.execute({
      sql: `UPDATE campanhas SET status = 'pronta', atualizado_em = ? WHERE id = ? AND status = 'preparando'`,
      args: [agora(), p.campanhaId],
    });
    await notificar(banco, {
      tipo: "campanha_concluida",
      titulo: "Campanha pronta para revisão",
      corpo: `"${campanha.nome}": e-mails preparados. Revise os previews e autorize o envio.`,
      link: `/campanhas/${p.campanhaId}`,
    });
  }
  return `${preparados} lead(s) preparado(s), ${falhas} falha(s), ${faltam} restante(s)`;
}

// ---------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------

export async function processarEnvioCampanha(banco: Client, p: PayloadCampanhaV2): Promise<string> {
  const inicio = Date.now();
  const { rows: cr } = await banco.execute({ sql: `SELECT * FROM campanhas WHERE id = ?`, args: [p.campanhaId] });
  const c = cr[0];
  if (!c) return "campanha removida";
  if (!c.autorizada_em) return "campanha não autorizada — nada enviado";
  if (c.status === "pausada" || c.status === "cancelada" || c.status === "concluida") return `campanha ${c.status} — nada enviado`;

  if (c.status === "agendada") {
    await banco.execute({ sql: `UPDATE campanhas SET status = 'enviando' WHERE id = ? AND status = 'agendada'`, args: [p.campanhaId] });
  }

  // Envio que ficou preso em "enviando" (worker derrubado no meio) volta à fila.
  await banco.execute({
    sql: `UPDATE envios SET status = 'agendado' WHERE campanha_id = ? AND status = 'enviando' AND atualizado_em < datetime('now', '-15 minutes')`,
    args: [p.campanhaId],
  });

  const ritmo = Math.max(1, Number(c.ritmo_por_hora));
  const intervaloMs = Math.max(20_000, Math.round(3_600_000 / ritmo));
  const provedor = ehProvedorEmail(c.provedor_email) ? provedorEmail(c.provedor_email) : undefined;

  const [{ rows: hojeCamp }, { rows: hojeTodas }, { rows: ultimaHora }] = await Promise.all([
    banco.execute({ sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND date(enviado_em) = date('now')`, args: [p.campanhaId] }),
    banco.execute(`SELECT COUNT(*) AS n FROM envios WHERE date(enviado_em) = date('now')`),
    banco.execute({ sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND enviado_em >= datetime('now', '-1 hour')`, args: [p.campanhaId] }),
  ]);
  let enviadosCampanhaHoje = Number(hojeCamp[0]?.n ?? 0);
  let enviadosHoje = Number(hojeTodas[0]?.n ?? 0);
  let naUltimaHora = Number(ultimaHora[0]?.n ?? 0);
  const teto = await tetoGlobal(banco);

  let enviados = 0;
  let falhas = 0;
  let proximo: string | null = null;

  while (Date.now() - inicio < ORCAMENTO_MS) {
    if (enviadosCampanhaHoje >= Number(c.limite_diario) || enviadosHoje >= teto) {
      proximo = "amanha";
      break;
    }
    if (naUltimaHora >= ritmo) {
      proximo = "hora";
      break;
    }

    const { rows } = await banco.execute({
      sql: `SELECT id, lead_id, campanha_id, passo, destinatario, assunto, corpo, token FROM envios
            WHERE campanha_id = ? AND status = 'agendado' AND agendado_para <= ?
            ORDER BY passo, agendado_para LIMIT 1`,
      args: [p.campanhaId, agora()],
    });
    const envio = rows[0] as unknown as EnvioParaSair | undefined;
    if (!envio) break;

    const r = await enviarUm(banco, envio, provedor);
    if (r.ok) {
      enviados += 1;
      enviadosHoje += 1;
      enviadosCampanhaHoje += 1;
      naUltimaHora += 1;
    } else if (!r.pulado) {
      falhas += 1;
      if (r.temporario) {
        proximo = "erro";
        break;
      }
      // Erro de configuração afeta todos: pausa e avisa, em vez de queimar a lista.
      if (/não configurado|não está configurad|recusou a chave|Nenhuma conta Google/i.test(r.erro)) {
        await banco.execute({ sql: `UPDATE campanhas SET status = 'pausada' WHERE id = ?`, args: [p.campanhaId] });
        await notificar(banco, { tipo: "erro_campanha", titulo: "Campanha pausada", corpo: `"${c.nome}": ${r.erro}`, link: `/campanhas/${p.campanhaId}` });
        return `pausada por erro de configuração: ${r.erro}`;
      }
    }

    // Pausa entre envios: com intervalo curto espera aqui; com longo,
    // devolve o job para a hora certa.
    if (intervaloMs > 60_000) {
      proximo = "intervalo";
      break;
    }
    await new Promise((res) => setTimeout(res, intervaloMs));
  }

  if (falhas > 0 && enviados === 0 && proximo !== "erro") {
    await notificar(banco, { tipo: "erro_campanha", titulo: "Falhas no envio", corpo: `"${c.nome}": ${falhas} e-mail(s) não saíram. Veja os detalhes.`, link: `/campanhas/${p.campanhaId}` });
  }

  if (await concluirSeTerminou(banco, p.campanhaId)) {
    const { rows: tot } = await banco.execute({ sql: `SELECT enviados, falhas FROM campanhas WHERE id = ?`, args: [p.campanhaId] });
    await notificar(banco, {
      tipo: "campanha_concluida",
      titulo: "Campanha concluída",
      corpo: `"${c.nome}": ${tot[0]?.enviados ?? 0} enviado(s), ${tot[0]?.falhas ?? 0} falha(s).`,
      link: `/campanhas/${p.campanhaId}`,
    });
    return `${enviados} enviado(s) — campanha concluída`;
  }

  // Quando voltar: o próximo envio agendado (follow-up daqui a dias) ou
  // a próxima janela de ritmo/limite.
  const { rows: prox } = await banco.execute({
    sql: `SELECT MIN(agendado_para) AS quando FROM envios WHERE campanha_id = ? AND status = 'agendado'`,
    args: [p.campanhaId],
  });
  const emMs = (ms: number) => new Date(Date.now() + ms).toISOString().replace("T", " ").slice(0, 19);
  const esperaMs = { hora: 10 * 60_000, erro: 15 * 60_000, intervalo: intervaloMs }[proximo ?? ""] ?? 0;
  const proximoAgendado = prox[0]?.quando ? String(prox[0].quando) : agora();
  // Sem fila devida agora, volta quando o próximo envio vencer (um
  // follow-up daqui a dias); com espera de ritmo, depois da espera.
  const quando = esperaMs > 0 ? emMs(esperaMs) : proximoAgendado > agora() ? proximoAgendado : emMs(60_000);

  await banco.execute({
    sql:
      proximo === "amanha"
        ? `INSERT INTO jobs (id, tipo, payload, status, disponivel_em) VALUES (?, 'enviar_campanha', ?, 'pendente', datetime('now', '+1 day', 'start of day', '+11 hours'))`
        : `INSERT INTO jobs (id, tipo, payload, status, disponivel_em) VALUES (?, 'enviar_campanha', ?, 'pendente', ?)`,
    args: proximo === "amanha" ? [novoId(), JSON.stringify(p)] : [novoId(), JSON.stringify(p), quando],
  });

  return `${enviados} enviado(s), ${falhas} falha(s)${proximo ? ` — retoma (${proximo})` : ""}`;
}
