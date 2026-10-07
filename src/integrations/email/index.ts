import nodemailer from "nodemailer";

import { getBanco } from "@/db/cliente";
import { obterSegredo } from "@/integrations/segredos";
import { enviarEmail as enviarPeloGmail, ErroGoogle } from "@/lib/google/oauth";

/**
 * Envio de e-mail, desacoplado do provedor.
 *
 * Três implementações de `EmailProvider`:
 * - Gmail (OAuth, a conta conectada em Configurações) — sem domínio próprio.
 * - Resend (API HTTP) — exige domínio verificado no Resend.
 * - SMTP — Hostinger Mail ou qualquer servidor SMTP.
 *
 * O provedor ativo é escolhido em Configurações → E-mail
 * (`configuracoes.email_provedor`). Credenciais: a senha SMTP e a chave
 * do Resend ficam cifradas em `integracoes`; host, porta, usuário e
 * remetente são ajustes comuns, em `configuracoes`.
 */

export type NomeProvedorEmail = "gmail" | "resend" | "smtp";

export type MensagemEmail = {
  para: string;
  assunto: string;
  texto: string;
  html: string | null;
  remetenteNome: string;
  /** Endereço de resposta (opcional). */
  responderPara: string | null;
  cabecalhos: Record<string, string>;
};

export interface EmailProvider {
  readonly nome: NomeProvedorEmail;
  readonly rotulo: string;
  /** Configurado o suficiente para tentar um envio? Não envia nada. */
  pronto(): Promise<{ ok: boolean; motivo: string | null }>;
  enviar(m: MensagemEmail): Promise<{ id: string }>;
}

export class ErroEmail extends Error {
  constructor(
    mensagem: string,
    readonly temporario = false,
  ) {
    super(mensagem);
  }
}

async function config(): Promise<Record<string, string>> {
  const { rows } = await getBanco().execute(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'email_%' OR chave LIKE 'smtp_%'`);
  return Object.fromEntries(rows.map((r) => [String(r.chave), String(r.valor)]));
}

function semQuebra(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

// ---------------------------------------------------------------------

export const gmail: EmailProvider = {
  nome: "gmail",
  rotulo: "Gmail",
  async pronto() {
    const { rows } = await getBanco().execute(`SELECT email FROM contas_google WHERE id = 1`);
    if (!rows[0]) return { ok: false, motivo: "Nenhuma conta Google conectada." };
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return { ok: false, motivo: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não estão no ambiente." };
    }
    return { ok: true, motivo: null };
  },
  async enviar(m) {
    try {
      const id = await enviarPeloGmail({
        para: m.para,
        assunto: m.assunto,
        corpo: m.texto,
        html: m.html ?? undefined,
        remetenteNome: m.remetenteNome,
        cabecalhos: { ...m.cabecalhos, ...(m.responderPara ? { "Reply-To": m.responderPara } : {}) },
      });
      return { id };
    } catch (erro) {
      if (erro instanceof ErroGoogle) throw new ErroEmail(erro.message, erro.temporario);
      throw erro;
    }
  },
};

export const resend: EmailProvider = {
  nome: "resend",
  rotulo: "Resend",
  async pronto() {
    const c = await config();
    if (!(await obterSegredo("RESEND_API_KEY"))) return { ok: false, motivo: "Chave do Resend não configurada." };
    if (!c.email_remetente) return { ok: false, motivo: "Defina o e-mail remetente (do domínio verificado no Resend)." };
    return { ok: true, motivo: null };
  },
  async enviar(m) {
    const chave = await obterSegredo("RESEND_API_KEY");
    const c = await config();
    if (!chave || !c.email_remetente) throw new ErroEmail("Resend não configurado.");

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${semQuebra(m.remetenteNome)} <${c.email_remetente}>`,
        to: [m.para],
        subject: semQuebra(m.assunto),
        text: m.texto,
        ...(m.html ? { html: m.html } : {}),
        ...(m.responderPara ? { reply_to: m.responderPara } : {}),
        headers: m.cabecalhos,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const dados = (await resposta.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!resposta.ok || !dados.id) {
      throw new ErroEmail(`Resend recusou o envio: ${dados.message ?? resposta.status}`, resposta.status === 429 || resposta.status >= 500);
    }
    return { id: dados.id };
  },
};

export const smtp: EmailProvider = {
  nome: "smtp",
  rotulo: "SMTP (Hostinger e outros)",
  async pronto() {
    const c = await config();
    if (!c.smtp_host || !c.smtp_usuario) return { ok: false, motivo: "Preencha servidor e usuário SMTP." };
    if (!(await obterSegredo("SMTP_PASSWORD"))) return { ok: false, motivo: "Senha SMTP não configurada." };
    return { ok: true, motivo: null };
  },
  async enviar(m) {
    const c = await config();
    const senha = await obterSegredo("SMTP_PASSWORD");
    if (!c.smtp_host || !c.smtp_usuario || !senha) throw new ErroEmail("SMTP não configurado.");
    const porta = Number(c.smtp_porta || 465);

    const transporte = nodemailer.createTransport({
      host: c.smtp_host,
      port: porta,
      secure: porta === 465,
      auth: { user: c.smtp_usuario, pass: senha },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });
    try {
      const info = await transporte.sendMail({
        from: { name: semQuebra(m.remetenteNome), address: c.email_remetente || c.smtp_usuario },
        to: m.para,
        subject: semQuebra(m.assunto),
        text: m.texto,
        html: m.html ?? undefined,
        replyTo: m.responderPara ?? undefined,
        headers: m.cabecalhos,
      });
      return { id: info.messageId };
    } catch (erro) {
      const codigo = (erro as { responseCode?: number }).responseCode ?? 0;
      throw new ErroEmail(
        `O servidor SMTP recusou: ${erro instanceof Error ? erro.message : String(erro)}`,
        codigo === 0 || (codigo >= 400 && codigo < 500),
      );
    }
  },
};

const PROVEDORES: Record<NomeProvedorEmail, EmailProvider> = { gmail, resend, smtp };

export function ehProvedorEmail(v: unknown): v is NomeProvedorEmail {
  return v === "gmail" || v === "resend" || v === "smtp";
}

export function provedorEmail(nome: NomeProvedorEmail): EmailProvider {
  return PROVEDORES[nome];
}

/** O provedor escolhido em Configurações (Gmail, se nenhum). */
export async function provedorEmailAtivo(): Promise<EmailProvider> {
  const c = await config();
  return PROVEDORES[ehProvedorEmail(c.email_provedor) ? c.email_provedor : "gmail"];
}

export async function estadoProvedoresEmail(): Promise<Array<{ nome: NomeProvedorEmail; rotulo: string; ok: boolean; motivo: string | null }>> {
  return Promise.all(
    Object.values(PROVEDORES).map(async (p) => ({ nome: p.nome, rotulo: p.rotulo, ...(await p.pronto()) })),
  );
}
