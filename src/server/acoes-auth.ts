"use server";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { agora, getBancoPrincipal, novoId } from "@/db/cliente";
import { CONTA_PRINCIPAL } from "@/db/contas-banco";
import { avisarDono } from "@/integrations/notificacoes";
import { criarValorDeSessao, NOME_COOKIE, OPCOES_COOKIE, senhaCorreta } from "@/lib/auth";
import type { IdPlano } from "@/lib/planos";
import { conferirSenha, criarConta, ErroConta, hashSenha, senhaFraca, usuarioPorEmail } from "@/services/contas";
import { limitar } from "@/server/erros";
import type { EstadoAcao } from "@/server/estado-acao";

async function ipDaRequisicao(): Promise<string> {
  return ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
}

/** Só destino interno. Sem isto, `?destino=https://…` viraria um redirecionador aberto. */
function destinoSeguro(bruto: string): string {
  return bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : "/";
}

async function abrirSessao(usuarioId: string | null, contaId: string): Promise<void> {
  const { valor, expiraEm } = await criarValorDeSessao(usuarioId, contaId);
  (await cookies()).set(NOME_COOKIE, valor, { ...OPCOES_COOKIE, expires: expiraEm });
  if (usuarioId) {
    await getBancoPrincipal()
      .execute({ sql: `UPDATE usuarios SET ultimo_acesso_em = ? WHERE id = ?`, args: [agora(), usuarioId] })
      .catch(() => {});
  }
}

export async function entrar(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const destino = destinoSeguro(String(form.get("destino") ?? ""));

  if (email === "" || senha === "") return { mensagem: "Informe e-mail e senha." };

  // Força bruta: no máximo 8 tentativas por IP a cada 15 minutos.
  try {
    await limitar(`login:${await ipDaRequisicao()}`, 8, 15 * 60);
  } catch {
    return { mensagem: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
  }

  const usuario = await usuarioPorEmail(email);
  if (usuario && usuario.ativo && (await conferirSenha(senha, usuario.senha_hash))) {
    await abrirSessao(usuario.id, usuario.conta_id);
    revalidatePath("/", "layout");
    redirect(destino);
  }

  // O dono entra também com a senha do painel (SENHA_PAINEL). No primeiro
  // login assim, o e-mail digitado vira o usuário administrador.
  if (senhaCorreta(senha)) {
    const banco = getBancoPrincipal();
    const { rows } = await banco.execute(`SELECT id, email FROM usuarios WHERE admin = 1 LIMIT 1`);
    const admin = rows[0];
    if (!admin && !usuario) {
      const id = novoId();
      await banco.execute({
        sql: `INSERT INTO usuarios (id, conta_id, nome, email, senha_hash, papel, admin) VALUES (?, ?, 'Dono', ?, ?, 'dono', 1)`,
        args: [id, CONTA_PRINCIPAL, email, await hashSenha(senha)],
      });
      await abrirSessao(id, CONTA_PRINCIPAL);
      revalidatePath("/", "layout");
      redirect(destino);
    }
    if (admin && String(admin.email).toLowerCase() === email) {
      await abrirSessao(String(admin.id), CONTA_PRINCIPAL);
      revalidatePath("/", "layout");
      redirect(destino);
    }
  }

  // Uma pausa curta encarece a força bruta sem atrapalhar quem só errou uma vez.
  await new Promise((r) => setTimeout(r, 600));
  return { mensagem: "E-mail ou senha incorretos." };
}

export async function cadastrar(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = String(form.get("nome") ?? "").trim();
  const empresa = String(form.get("empresa") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const telefone = String(form.get("telefone") ?? "").replace(/\D/g, "") || null;
  const planoBruto = String(form.get("plano") ?? "pro");
  const plano = (["essencial", "pro", "agencia"].includes(planoBruto) ? planoBruto : "pro") as IdPlano;
  const aceite = form.get("aceite") === "on";

  if (nome.length < 2) return { mensagem: "Informe seu nome." };
  if (!aceite) return { mensagem: "Para criar a conta, aceite os Termos de uso e a Política de privacidade." };

  try {
    await limitar(`cadastro:${await ipDaRequisicao()}`, 5, 60 * 60);
  } catch {
    return { mensagem: "Muitos cadastros seguidos deste endereço. Tente de novo em uma hora." };
  }

  let resultado: Awaited<ReturnType<typeof criarConta>>;
  try {
    resultado = await criarConta({ nome, empresa, email, senha, telefone, plano, origem: String(form.get("origem") ?? "") || null });
  } catch (erro) {
    if (erro instanceof ErroConta) return { mensagem: erro.message };
    console.error("[cadastro]", erro);
    return { mensagem: "Não conseguimos criar a conta agora. Tente de novo em instantes." };
  }

  await avisarDono({
    tipo: "conta_nova",
    titulo: `Novo cadastro: ${resultado.conta.nome}`,
    corpo: `${nome} · plano ${plano.toUpperCase()} em teste${resultado.avisoBanco ? ` · ATENÇÃO: banco não criado (${resultado.avisoBanco})` : ""}`,
    link: `/admin/membros/${resultado.conta.id}`,
  });

  await abrirSessao(resultado.usuario.id, resultado.conta.id);
  revalidatePath("/", "layout");
  redirect("/?bem-vindo=1");
}

export async function sair(): Promise<void> {
  (await cookies()).delete(NOME_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Recuperar senha ────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Manda o link de redefinição. A resposta é sempre a mesma, exista o
 * e-mail ou não — senão a tela vira um jeito de descobrir quem é cliente.
 */
export async function pedirRedefinicao(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const resposta: EstadoAcao = { mensagem: null, sucesso: "Se houver uma conta com este e-mail, o link para criar uma senha nova chega em alguns minutos. Confira também o spam." };
  if (!email) return { mensagem: "Informe o e-mail." };
  try {
    await limitar(`redefinir:${await ipDaRequisicao()}`, 5, 60 * 60);
  } catch {
    return { mensagem: "Muitos pedidos seguidos. Tente de novo em uma hora." };
  }

  const usuario = await usuarioPorEmail(email);
  if (!usuario || !usuario.ativo) return resposta;

  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + 60 * 60_000).toISOString().replace("T", " ").slice(0, 19);
  await getBancoPrincipal().execute({
    sql: `INSERT INTO redefinicoes_senha (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)`,
    args: [hashToken(token), usuario.id, expira],
  });

  const h = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${base}/redefinir-senha/${token}`;
  try {
    const { enviarEmailDoSistema } = await import("@/services/email-sistema");
    await enviarEmailDoSistema({
      para: usuario.email,
      assunto: "Crie uma senha nova — Vynexa Leads",
      texto: `Olá, ${usuario.nome}.\n\nPara criar uma senha nova, abra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você que pediu, ignore este e-mail: sua senha continua a mesma.`,
    });
  } catch (erro) {
    console.error("[redefinir senha] e-mail não enviado:", erro instanceof Error ? erro.message : erro);
  }
  return resposta;
}

export async function redefinirSenha(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const token = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");
  const fraca = senhaFraca(senha);
  if (fraca) return { mensagem: fraca };

  const banco = getBancoPrincipal();
  const { rows } = await banco.execute({
    sql: `SELECT r.usuario_id, u.conta_id FROM redefinicoes_senha r JOIN usuarios u ON u.id = r.usuario_id
          WHERE r.token_hash = ? AND r.usado_em IS NULL AND r.expira_em > ?`,
    args: [hashToken(token), agora()],
  });
  if (!rows[0]) return { mensagem: "Este link venceu ou já foi usado. Peça um novo em “Esqueci a senha”." };

  const usuarioId = String(rows[0].usuario_id);
  await banco.batch(
    [
      { sql: `UPDATE usuarios SET senha_hash = ? WHERE id = ?`, args: [await hashSenha(senha), usuarioId] },
      { sql: `UPDATE redefinicoes_senha SET usado_em = ? WHERE token_hash = ?`, args: [agora(), hashToken(token)] },
    ],
    "write",
  );
  await abrirSessao(usuarioId, String(rows[0].conta_id));
  revalidatePath("/", "layout");
  redirect("/");
}
