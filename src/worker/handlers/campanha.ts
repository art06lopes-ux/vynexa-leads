import type { Client } from "@libsql/client";

import { agora, novoId } from "@/db/cliente";
import type { Empresa } from "@/db/tipos";
import { ESQUEMA_EMAIL, montarInstrucaoEmail, validarEmail } from "@/lib/ia/email";
import { ErroGemini, pedirJson } from "@/lib/ia/gemini";
import { enviarEmail, ErroGoogle } from "@/lib/google/oauth";
import { esperar } from "@/lib/osm/limitador";

export type PayloadCampanha = { campanhaId: string };

/**
 * Limite diário de envios.
 *
 * O Gmail pessoal corta em 500 destinatários por dia. Cem é o teto aqui,
 * de propósito: uma conta nova que dispara 500 e-mails frios num dia
 * acorda com a reputação queimada e tudo caindo em spam. Cem por dia,
 * com pausa entre cada um, é o que uma pessoa mandando à mão faria.
 */
const TETO_DIARIO = 100;
const PAUSA_ENTRE_ENVIOS_MS = 20_000;
const ORCAMENTO_MS = 3 * 60 * 1000;

// ---------------------------------------------------------------------
// 1. Gerar os e-mails da campanha (um por lead), com IA
// ---------------------------------------------------------------------

export async function processarGeracao(banco: Client, payload: PayloadCampanha): Promise<string> {
  const inicio = Date.now();

  const { rows: cfg } = await banco.execute(`SELECT chave, valor FROM configuracoes`);
  const config = Object.fromEntries(cfg.map((r) => [String(r.chave), String(r.valor)]));
  const remetente = {
    nome: config.remetente_nome ?? "Pedro",
    empresa: config.empresa_nome ?? "Vynexa Dev",
  };

  // Envios ainda sem corpo, desta campanha, cujo lead tem e-mail.
  const { rows } = await banco.execute({
    sql: `SELECT en.id AS envio_id, e.*, l.motivo_problema
          FROM envios en
          JOIN leads l ON l.id = en.lead_id
          JOIN empresas e ON e.id = l.empresa_id
          WHERE en.campanha_id = ? AND en.status = 'pendente' AND en.corpo IS NULL
            AND e.email IS NOT NULL AND e.email <> ''
          LIMIT 20`,
    args: [payload.campanhaId],
  });

  let gerados = 0;
  const falhas: string[] = [];

  for (const r of rows) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    const empresa = r as unknown as Empresa & { envio_id: string; motivo_problema: string | null };

    try {
      const bruto = await pedirJson<unknown>(
        montarInstrucaoEmail(empresa, remetente, empresa.motivo_problema),
        ESQUEMA_EMAIL,
      );
      const email = validarEmail(bruto, remetente.nome);

      await banco.execute({
        sql: `UPDATE envios SET assunto = ?, corpo = ?, status = 'na_fila', gerado_em = ?, atualizado_em = ?
              WHERE id = ?`,
        args: [email.assunto, email.corpo, agora(), agora(), empresa.envio_id],
      });
      gerados += 1;
    } catch (erro) {
      if (erro instanceof ErroGemini && erro.temporario) {
        if (gerados === 0) throw erro;
        break;
      }
      falhas.push(`${empresa.nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
      await banco.execute({
        sql: `UPDATE envios SET status = 'erro', erro = ?, atualizado_em = ? WHERE id = ?`,
        args: [erro instanceof Error ? erro.message : String(erro), agora(), empresa.envio_id],
      });
    }
  }

  const { rows: restantes } = await banco.execute({
    sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND status = 'pendente' AND corpo IS NULL`,
    args: [payload.campanhaId],
  });
  const faltam = Number(restantes[0]?.n ?? 0);

  if (faltam > 0 && gerados > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'gerar_emails', ?, 'pendente')`,
      args: [novoId(), JSON.stringify(payload)],
    });
  } else if (faltam === 0) {
    // Tudo gerado: a campanha entra em envio e o primeiro job de envio nasce.
    await banco.execute({
      sql: `UPDATE campanhas SET status = 'em_envio' WHERE id = ? AND status = 'rascunho'`,
      args: [payload.campanhaId],
    });
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'envio_email', ?, 'pendente')`,
      args: [novoId(), JSON.stringify(payload)],
    });
  }

  const resumo = `${gerados} e-mail(s) gerado(s), ${faltam} restante(s)`;
  return falhas.length > 0 ? `${resumo} — ${falhas.length} falha(s): ${falhas[0]}` : resumo;
}

async function agendarParaAmanha(banco: Client, payload: PayloadCampanha): Promise<void> {
  await banco.execute({
    sql: `INSERT INTO jobs (id, tipo, payload, status, disponivel_em)
          VALUES (?, 'envio_email', ?, 'pendente', datetime('now', '+1 day', 'start of day', '+8 hours'))`,
    args: [novoId(), JSON.stringify(payload)],
  });
}

// ---------------------------------------------------------------------
// 2. Enviar, com pausa e teto diário
// ---------------------------------------------------------------------

export async function processarEnvio(banco: Client, payload: PayloadCampanha): Promise<string> {
  const inicio = Date.now();

  const { rows: pausada } = await banco.execute({
    sql: `SELECT status FROM campanhas WHERE id = ?`,
    args: [payload.campanhaId],
  });
  if (pausada[0]?.status === "pausada") return "campanha pausada — nada enviado";

  const { rows: hoje } = await banco.execute(
    `SELECT COUNT(*) AS n FROM envios WHERE status = 'enviado' AND date(enviado_em) = date('now')`,
  );
  let enviadosHoje = Number(hoje[0]?.n ?? 0);

  if (enviadosHoje >= TETO_DIARIO) {
    // Volta amanhã. Um job novo, disponível só depois da meia-noite —
    // não um erro, porque erro gastaria tentativas num limite que é
    // esperado, e a campanha morreria no terceiro dia bom de envio.
    await agendarParaAmanha(banco, payload);
    return `teto diário de ${TETO_DIARIO} atingido — continua amanhã`;
  }

  const { rows } = await banco.execute({
    sql: `SELECT en.id, en.assunto, en.corpo, e.email, e.nome
          FROM envios en
          JOIN leads l ON l.id = en.lead_id
          JOIN empresas e ON e.id = l.empresa_id
          WHERE en.campanha_id = ? AND en.status = 'na_fila' AND en.corpo IS NOT NULL
          ORDER BY en.atualizado_em
          LIMIT ?`,
    args: [payload.campanhaId, Math.min(10, TETO_DIARIO - enviadosHoje)],
  });

  let enviados = 0;
  let falhas = 0;

  for (const r of rows) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    if (enviadosHoje >= TETO_DIARIO) break;

    const id = String(r.id);
    try {
      const gmailId = await enviarEmail({
        para: String(r.email),
        assunto: String(r.assunto),
        corpo: String(r.corpo),
      });

      await banco.execute({
        sql: `UPDATE envios SET status = 'enviado', enviado_em = ?, gmail_message_id = ?, tentativas = tentativas + 1, atualizado_em = ?
              WHERE id = ?`,
        args: [agora(), gmailId, agora(), id],
      });
      await banco.execute({
        sql: `UPDATE campanhas SET enviados = enviados + 1 WHERE id = ?`,
        args: [payload.campanhaId],
      });
      // Marca o lead como contatado — é o que o funil precisa saber.
      await banco.execute({
        sql: `UPDATE leads SET status = 'contatado', atualizado_em = ?
              WHERE id = (SELECT lead_id FROM envios WHERE id = ?) AND status = 'novo'`,
        args: [agora(), id],
      });

      enviados += 1;
      enviadosHoje += 1;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);

      if (erro instanceof ErroGoogle && erro.temporario) {
        // Cota ou instabilidade do Gmail: para tudo e deixa o job voltar.
        if (enviados === 0) throw erro;
        break;
      }

      // Token revogado ou endereço inválido: este envio falha, os outros
      // seguem. Registrar o motivo é o que permite o operador agir.
      await banco.execute({
        sql: `UPDATE envios SET status = 'erro', erro = ?, tentativas = tentativas + 1, atualizado_em = ? WHERE id = ?`,
        args: [mensagem, agora(), id],
      });
      await banco.execute({
        sql: `UPDATE campanhas SET falhas = falhas + 1 WHERE id = ?`,
        args: [payload.campanhaId],
      });
      if (erro instanceof ErroGoogle) {
        await banco.execute({
          sql: `UPDATE contas_google SET ultimo_erro = ? WHERE id = 1`,
          args: [mensagem],
        });
      }
      falhas += 1;
    }

    // Pausa humana entre envios. Sem ela o Gmail vê rajada.
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
  }

  const { rows: restantes } = await banco.execute({
    sql: `SELECT COUNT(*) AS n FROM envios WHERE campanha_id = ? AND status = 'na_fila'`,
    args: [payload.campanhaId],
  });
  const faltam = Number(restantes[0]?.n ?? 0);

  if (faltam > 0) {
    await banco.execute({
      sql: `INSERT INTO jobs (id, tipo, payload, status) VALUES (?, 'envio_email', ?, 'pendente')`,
      args: [novoId(), JSON.stringify(payload)],
    });
  } else {
    await banco.execute({
      sql: `UPDATE campanhas SET status = 'concluida' WHERE id = ? AND status = 'em_envio'`,
      args: [payload.campanhaId],
    });
  }

  return `${enviados} enviado(s), ${falhas} falha(s), ${faltam} na fila, ${enviadosHoje}/${TETO_DIARIO} hoje`;
}
