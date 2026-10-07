"use server";

import { revalidatePath } from "next/cache";

import { agora, getBanco, novoId } from "@/db/cliente";
import { gravarConfiguracao } from "@/db/configuracoes";
import { ehNomeSegredo, removerSegredo, salvarSegredo } from "@/integrations/segredos";
import { paraCentavos } from "@/lib/pagamento/dinheiro";
import { exigirSessao } from "@/server/sessao";
import { adicionarSupressaoManual, removerDaSupressao } from "@/services/supressao";

/**
 * Ações da tela de Configurações. Cada uma confere a sessão, aceita só
 * as chaves de uma lista de permissão e devolve uma mensagem legível.
 */

export type Resultado = { ok: boolean; mensagem: string };

const CHAVES: Record<string, (v: string) => string | null> = {
  // Identidade
  empresa_nome: (v) => v.slice(0, 80) || null,
  responsavel_nome: (v) => v.slice(0, 80) || null,
  empresa_email: (v) => (v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.slice(0, 160) : null),
  empresa_whatsapp: (v) => v.slice(0, 40),
  empresa_instagram: (v) => v.slice(0, 120),
  empresa_site: (v) => (v === "" || /^https?:\/\//i.test(v) ? v.slice(0, 200) : `https://${v}`.slice(0, 200)),
  cor_primaria: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null),
  cor_secundaria: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null),
  email_assinatura: (v) => v.slice(0, 600),
  // E-mail
  email_provedor: (v) => (["gmail", "resend", "smtp"].includes(v) ? v : null),
  email_remetente: (v) => (v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null),
  email_resposta: (v) => (v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null),
  email_dominio: (v) => v.replace(/^https?:\/\//, "").slice(0, 120),
  smtp_host: (v) => (/^[a-z0-9.-]*$/i.test(v) ? v : null),
  smtp_porta: (v) => (v === "" || /^\d{2,5}$/.test(v) ? v : null),
  smtp_usuario: (v) => v.slice(0, 160),
  email_teto_diario: (v) => (/^\d{1,4}$/.test(v) && Number(v) > 0 ? v : null),
  // Pagamentos
  asaas_ambiente: (v) => (v === "sandbox" || v === "producao" ? v : null),
  // Avançado
  app_url: (v) => (v === "" || /^https?:\/\/[^\s]+$/i.test(v) ? v.replace(/\/+$/, "") : null),
  fuso: (v) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: v });
      return v;
    } catch {
      return null;
    }
  },
  google_teto_requisicoes: (v) => (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 60 ? v : null),
  receita_ufs: (v) =>
    [...new Set(v.toUpperCase().split(/[,\s;]+/).filter((u) => /^[A-Z]{2}$/.test(u)))]
      .sort()
      .join(","),
};

export async function salvarConfiguracoes(form: FormData): Promise<Resultado> {
  await exigirSessao();
  const invalidos: string[] = [];
  for (const [chave, bruto] of form.entries()) {
    const limpar = CHAVES[chave];
    if (!limpar || typeof bruto !== "string") continue;
    const valor = limpar(bruto.trim());
    if (valor === null) {
      invalidos.push(chave);
      continue;
    }
    await gravarConfiguracao(chave, valor);
  }
  revalidatePath("/", "layout");
  return invalidos.length > 0 ? { ok: false, mensagem: `Alguns campos foram ignorados por estarem inválidos: ${invalidos.join(", ")}.` } : { ok: true, mensagem: "Configurações salvas." };
}

const TIPOS_LOGO = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function enviarLogo(form: FormData): Promise<Resultado> {
  await exigirSessao();
  const arquivo = form.get("logo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, mensagem: "Escolha um arquivo." };
  if (!TIPOS_LOGO.has(arquivo.type)) return { ok: false, mensagem: "Use PNG, JPG, WebP ou SVG." };
  if (arquivo.size > 300 * 1024) return { ok: false, mensagem: "O logo precisa ter até 300 KB." };
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (arquivo.type === "image/svg+xml" && /<script|on\w+=|javascript:/i.test(bytes.toString("utf8"))) {
    return { ok: false, mensagem: "Esse SVG contém script; exporte de novo sem código." };
  }
  await gravarConfiguracao("logo_data", `data:${arquivo.type};base64,${bytes.toString("base64")}`);
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Logo atualizado. Ele já aparece no painel, nos e-mails, nas propostas e nas notificações." };
}

export async function removerLogo(): Promise<Resultado> {
  await exigirSessao();
  await getBanco().execute(`DELETE FROM configuracoes WHERE chave = 'logo_data'`);
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Logo removido. O monograma provisório volta a aparecer." };
}

export async function salvarChave(nome: string, valor: string): Promise<Resultado> {
  await exigirSessao();
  if (!ehNomeSegredo(nome)) return { ok: false, mensagem: "Chave desconhecida." };
  try {
    await salvarSegredo(nome, valor);
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Não foi possível salvar." };
  }
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: "Chave salva (cifrada). Ela nunca volta para o navegador." };
}

export async function apagarChave(nome: string): Promise<Resultado> {
  await exigirSessao();
  if (!ehNomeSegredo(nome)) return { ok: false, mensagem: "Chave desconhecida." };
  await removerSegredo(nome);
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: "Chave removida." };
}

export async function salvarProduto(form: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = String(form.get("id") ?? "");
  const nome = String(form.get("nome") ?? "").trim().slice(0, 100);
  const tipo = String(form.get("tipo") ?? "");
  const descricao = String(form.get("descricao") ?? "").trim().slice(0, 500) || null;
  const entregaveis = String(form.get("entregaveis") ?? "").trim().slice(0, 2000) || null;
  const preco = paraCentavos(String(form.get("preco") ?? "0")) ?? 0;
  const ordem = Number(form.get("ordem") ?? 0) || 0;
  if (nome.length < 2) return { ok: false, mensagem: "Dê um nome ao produto." };
  if (!["site", "sistema", "app", "saas", "agendamento", "outro"].includes(tipo)) return { ok: false, mensagem: "Tipo inválido." };

  const banco = getBanco();
  if (id) {
    await banco.execute({
      sql: `UPDATE produtos SET nome = ?, tipo = ?, descricao = ?, entregaveis = ?, preco_centavos = ?, ordem = ? WHERE id = ?`,
      args: [nome, tipo, descricao, entregaveis, preco, ordem, id],
    });
  } else {
    await banco.execute({
      sql: `INSERT INTO produtos (id, nome, tipo, descricao, entregaveis, preco_centavos, moeda, ativo, ordem, criado_em) VALUES (?, ?, ?, ?, ?, ?, 'BRL', 1, ?, ?)`,
      args: [novoId(), nome, tipo, descricao, entregaveis, preco, ordem, agora()],
    });
  }
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: id ? "Produto atualizado." : "Produto criado." };
}

export async function arquivarProduto(id: string, ativo: boolean): Promise<Resultado> {
  await exigirSessao();
  await getBanco().execute({ sql: `UPDATE produtos SET ativo = ? WHERE id = ?`, args: [ativo ? 1 : 0, id] });
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: ativo ? "Produto reativado." : "Produto arquivado (some das sugestões da IA)." };
}

/** Catálogo inicial com os produtos da especificação, sem preço (o operador define). */
export async function criarCatalogoInicial(): Promise<Resultado> {
  await exigirSessao();
  const banco = getBanco();
  const { rows } = await banco.execute(`SELECT COUNT(*) n FROM produtos`);
  if (Number(rows[0]?.n ?? 0) > 0) return { ok: false, mensagem: "O catálogo já tem produtos." };
  const base: Array<[string, string, string]> = [
    ["Site Essencial", "site", "Página única com serviços, localização, avaliações e botão de WhatsApp."],
    ["Site Profissional", "site", "Site com várias páginas, domínio próprio e otimização para o Google."],
    ["Site Premium", "site", "Site sob medida, com animações, blog e integrações."],
    ["Sistema de agendamento", "agendamento", "Agenda online com confirmação por WhatsApp."],
    ["Sistema personalizado", "sistema", "Sistema web sob medida para a operação do cliente."],
    ["Aplicativo", "app", "Aplicativo para Android e iPhone."],
    ["SaaS", "saas", "Produto em assinatura, multiempresa."],
  ];
  const instante = agora();
  await banco.batch(
    base.map(([nome, tipo, descricao], i) => ({
      sql: `INSERT INTO produtos (id, nome, tipo, descricao, preco_centavos, moeda, ativo, ordem, criado_em) VALUES (?, ?, ?, ?, 0, 'BRL', 1, ?, ?)`,
      args: [novoId(), nome, tipo, descricao, i, instante],
    })),
    "write",
  );
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: "Catálogo criado. Defina os preços de cada produto." };
}

export async function adicionarSupressao(tipo: string, valor: string, pais: string): Promise<Resultado> {
  await exigirSessao();
  if (tipo !== "email" && tipo !== "telefone" && tipo !== "dominio") return { ok: false, mensagem: "Tipo inválido." };
  try {
    const v = await adicionarSupressaoManual(getBanco(), tipo, valor, pais || "BR");
    revalidatePath("/configuracoes");
    return { ok: true, mensagem: `${v} adicionado à lista de não contatar.` };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Valor inválido." };
  }
}

export async function tirarDaSupressao(tipo: string, valor: string): Promise<Resultado> {
  await exigirSessao();
  await removerDaSupressao(getBanco(), tipo, valor);
  revalidatePath("/configuracoes");
  return { ok: true, mensagem: "Removido da lista. Empresas já marcadas como “não contatar” continuam marcadas." };
}
