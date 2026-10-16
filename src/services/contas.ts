import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { agora, getBancoPrincipal, novoId } from "@/db/cliente";
import { comConta, contaDoContexto, CONTA_PRINCIPAL, criarBancoDaConta, esquecerConta } from "@/db/contas-banco";
import { PLANO_DONO, PLANOS_PADRAO, RECURSOS_DO_PLANO, type IdPlano, type Limites, type Plano, type Recurso } from "@/lib/planos";

/**
 * Contas do SaaS: cadastro, senha, plano, situação da assinatura e uso
 * do mês. Tudo aqui lê e grava no banco PRINCIPAL (controle), nunca no
 * banco do assinante.
 *
 * Sem `server-only`: o worker do GitHub Actions também conta uso de leads.
 */

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

export class ErroConta extends Error {
  constructor(
    mensagem: string,
    readonly status = 400,
  ) {
    super(mensagem);
    this.name = "ErroConta";
  }
}

// ── Senha ──────────────────────────────────────────────────────────────

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 32);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

export async function conferirSenha(senha: string, guardado: string | null): Promise<boolean> {
  const [tipo, salHex, hashHex] = (guardado ?? "").split("$");
  if (tipo !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = await scrypt(senha, Buffer.from(salHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

export function senhaFraca(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

// ── Planos ─────────────────────────────────────────────────────────────

let cachePlanos: { valor: Plano[]; ate: number } | null = null;

/** Planos à venda, com preço e limites do banco (o que o admin ajustou). */
export async function listarPlanos(): Promise<Plano[]> {
  if (cachePlanos && cachePlanos.ate > Date.now()) return cachePlanos.valor;
  let linhas: Array<Record<string, unknown>> = [];
  try {
    linhas = (await getBancoPrincipal().execute(`SELECT * FROM planos WHERE ativo = 1`)).rows as unknown as Array<Record<string, unknown>>;
  } catch {
    linhas = [];
  }
  const valor = PLANOS_PADRAO.map((p) => {
    const l = linhas.find((r) => r.id === p.id);
    if (!l) return p;
    let limites: Partial<Limites> = {};
    try {
      limites = JSON.parse(String(l.limites ?? "{}")) as Partial<Limites>;
    } catch {
      limites = {};
    }
    return {
      ...p,
      nome: String(l.nome ?? p.nome),
      descricao: l.descricao ? String(l.descricao) : p.descricao,
      precoCentavos: Number(l.preco_centavos ?? p.precoCentavos),
      destaque: Number(l.destaque ?? 0) === 1,
      limites: { ...p.limites, ...limites },
    };
  });
  cachePlanos = { valor, ate: Date.now() + 60_000 };
  return valor;
}

export async function planoPorId(id: string): Promise<Plano> {
  if (id === "dono") return PLANO_DONO;
  return (await listarPlanos()).find((p) => p.id === id) ?? PLANOS_PADRAO[0];
}

export async function salvarPlano(p: { id: IdPlano; nome: string; descricao: string; precoCentavos: number; destaque: boolean; limites: Limites }): Promise<void> {
  const banco = getBancoPrincipal();
  const statements = [
    {
      sql: `INSERT INTO planos (id, nome, descricao, preco_centavos, destaque, limites, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, descricao = excluded.descricao, preco_centavos = excluded.preco_centavos,
              destaque = excluded.destaque, limites = excluded.limites, atualizado_em = excluded.atualizado_em`,
      args: [p.id, p.nome, p.descricao, p.precoCentavos, p.destaque ? 1 : 0, JSON.stringify(p.limites), agora()],
    },
  ];
  // Só um plano em destaque ("mais vendido").
  if (p.destaque) statements.push({ sql: `UPDATE planos SET destaque = 0 WHERE id <> ?`, args: [p.id] });
  await banco.batch(statements, "write");
  cachePlanos = null;
}

// ── Contas ─────────────────────────────────────────────────────────────

export type StatusConta = "teste" | "ativa" | "atrasada" | "cancelada" | "bloqueada";

export type Conta = {
  id: string;
  nome: string;
  plano: IdPlano;
  status: StatusConta;
  valida_ate: string | null;
  banco_tipo: string;
  documento: string | null;
  telefone: string | null;
  asaas_cliente_id: string | null;
  asaas_assinatura_id: string | null;
  origem: string | null;
  observacao: string | null;
  criado_em: string;
  cancelada_em: string | null;
};

export type Usuario = {
  id: string;
  conta_id: string;
  nome: string;
  email: string;
  senha_hash: string | null;
  papel: "dono" | "membro";
  admin: number;
  ativo: number;
  ultimo_acesso_em: string | null;
  criado_em: string;
};

/** Dias de carência depois do vencimento antes de travar o acesso. */
export const CARENCIA_DIAS = 3;

export async function lerConta(id: string): Promise<Conta | null> {
  const { rows } = await getBancoPrincipal().execute({ sql: `SELECT * FROM contas WHERE id = ?`, args: [id] });
  return rows[0] ? ({ ...rows[0] } as unknown as Conta) : null;
}

export async function lerUsuario(id: string): Promise<Usuario | null> {
  const { rows } = await getBancoPrincipal().execute({ sql: `SELECT * FROM usuarios WHERE id = ?`, args: [id] });
  return rows[0] ? ({ ...rows[0] } as unknown as Usuario) : null;
}

export async function usuarioPorEmail(email: string): Promise<Usuario | null> {
  const { rows } = await getBancoPrincipal().execute({ sql: `SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE`, args: [email.trim()] });
  return rows[0] ? ({ ...rows[0] } as unknown as Usuario) : null;
}

export type Acesso = { liberado: true } | { liberado: false; motivo: "vencida" | "cancelada" | "bloqueada" | "sem_banco" };

/** Pode usar o sistema? O dono sempre; o assinante até o vencimento + carência. */
export function acessoDaConta(c: Conta, agoraMs = Date.now()): Acesso {
  if (c.id === CONTA_PRINCIPAL) return { liberado: true };
  if (c.status === "bloqueada") return { liberado: false, motivo: "bloqueada" };
  if (c.banco_tipo === "pendente") return { liberado: false, motivo: "sem_banco" };
  const vence = c.valida_ate ? Date.parse(`${c.valida_ate.replace(" ", "T")}Z`) : 0;
  if (vence + CARENCIA_DIAS * 86_400_000 >= agoraMs) return { liberado: true };
  return { liberado: false, motivo: c.status === "cancelada" ? "cancelada" : "vencida" };
}

export function diasRestantes(c: Conta, agoraMs = Date.now()): number | null {
  if (!c.valida_ate) return null;
  return Math.ceil((Date.parse(`${c.valida_ate.replace(" ", "T")}Z`) - agoraMs) / 86_400_000);
}

export async function diasDeTeste(): Promise<number> {
  const { rows } = await getBancoPrincipal().execute(`SELECT valor FROM configuracoes WHERE chave = 'saas_teste_dias'`);
  const n = Number(rows[0]?.valor);
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

function emDias(dias: number, base = Date.now()): string {
  return new Date(base + dias * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Cadastro: conta + usuário dono + banco próprio. Se o banco não puder
 * ser criado (cota do Cloudflare, token sem permissão), a conta fica
 * `pendente` e o dono do SaaS é avisado — o cliente não perde o cadastro.
 */
export async function criarConta(e: {
  nome: string;
  empresa: string;
  email: string;
  senha: string;
  telefone: string | null;
  plano: IdPlano;
  origem?: string | null;
}): Promise<{ conta: Conta; usuario: Usuario; avisoBanco: string | null }> {
  const email = e.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroConta("E-mail inválido.");
  const fraca = senhaFraca(e.senha);
  if (fraca) throw new ErroConta(fraca);
  if (!["essencial", "pro", "agencia"].includes(e.plano)) throw new ErroConta("Plano inválido.");
  if (await usuarioPorEmail(email)) throw new ErroConta("Já existe uma conta com este e-mail. Entre ou recupere a senha.", 409);

  const banco = getBancoPrincipal();
  const contaId = novoId();
  const usuarioId = novoId();
  const instante = agora();
  const teste = await diasDeTeste();
  await banco.batch(
    [
      {
        sql: `INSERT INTO contas (id, nome, plano, status, valida_ate, banco_tipo, telefone, origem, criado_em, atualizado_em)
              VALUES (?, ?, ?, 'teste', ?, 'pendente', ?, ?, ?, ?)`,
        args: [contaId, e.empresa.trim() || e.nome.trim(), e.plano, emDias(teste), e.telefone, e.origem ?? null, instante, instante],
      },
      {
        sql: `INSERT INTO usuarios (id, conta_id, nome, email, senha_hash, papel, criado_em) VALUES (?, ?, ?, ?, ?, 'dono', ?)`,
        args: [usuarioId, contaId, e.nome.trim(), email, await hashSenha(e.senha), instante],
      },
    ],
    "write",
  );

  let avisoBanco: string | null = null;
  try {
    await provisionarBanco(contaId, { empresa: e.empresa.trim() || e.nome.trim(), responsavel: e.nome.trim(), email, telefone: e.telefone });
  } catch (erro) {
    avisoBanco = erro instanceof Error ? erro.message : String(erro);
    console.error("[cadastro] banco da conta", contaId, avisoBanco);
  }

  const conta = (await lerConta(contaId))!;
  const usuario = (await lerUsuario(usuarioId))!;
  return { conta, usuario, avisoBanco };
}

/** Cria o banco da conta e grava a identidade inicial. Pode ser repetido pelo admin. */
export async function provisionarBanco(contaId: string, identidade: { empresa: string; responsavel: string; email: string; telefone: string | null }): Promise<void> {
  const ref = await criarBancoDaConta(contaId);
  await getBancoPrincipal().execute({
    sql: `UPDATE contas SET banco_tipo = ?, banco_ref = ?, atualizado_em = ? WHERE id = ?`,
    args: [ref.tipo, ref.ref, agora(), contaId],
  });
  esquecerConta(contaId);
  const { getBanco } = await import("@/db/cliente");
  await comConta(contaId, async () => {
    const pares: Array<[string, string]> = [
      ["empresa_nome", identidade.empresa],
      ["responsavel_nome", identidade.responsavel],
      ["empresa_email", identidade.email],
      ["moeda_padrao", "BRL"],
      ...(identidade.telefone ? ([["empresa_whatsapp", identidade.telefone]] as Array<[string, string]>) : []),
    ];
    await getBanco().batch(
      pares.map(([chave, valor]) => ({ sql: `INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)`, args: [chave, valor] })),
      "write",
    );
  });
}

export async function atualizarConta(id: string, campos: Partial<Pick<Conta, "plano" | "status" | "valida_ate" | "documento" | "telefone" | "asaas_cliente_id" | "asaas_assinatura_id" | "observacao" | "nome" | "cancelada_em">>): Promise<void> {
  const chaves = Object.keys(campos) as Array<keyof typeof campos>;
  if (chaves.length === 0) return;
  await getBancoPrincipal().execute({
    sql: `UPDATE contas SET ${chaves.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
    args: [...chaves.map((c) => (campos[c] ?? null) as string | null), agora(), id],
  });
}

/** Soma `dias` à validade a partir do que for maior: hoje ou o vencimento atual. */
export function estenderValidade(atual: string | null, dias: number, agoraMs = Date.now()): string {
  const base = Math.max(agoraMs, atual ? Date.parse(`${atual.replace(" ", "T")}Z`) : 0);
  return emDias(dias, base);
}

// ── Uso do mês ─────────────────────────────────────────────────────────

export function mesAtual(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export type ChaveUso = "leads" | "ia" | "google";

export async function usoDoMes(contaId: string, mes = mesAtual()): Promise<Record<ChaveUso, number>> {
  const { rows } = await getBancoPrincipal().execute({ sql: `SELECT chave, valor FROM uso_contas WHERE conta_id = ? AND mes = ?`, args: [contaId, mes] });
  const uso: Record<ChaveUso, number> = { leads: 0, ia: 0, google: 0 };
  for (const r of rows) if (String(r.chave) in uso) uso[String(r.chave) as ChaveUso] = Number(r.valor) || 0;
  return uso;
}

export async function registrarUso(contaId: string, chave: ChaveUso, n: number): Promise<void> {
  if (n <= 0) return;
  await getBancoPrincipal().execute({
    sql: `INSERT INTO uso_contas (conta_id, mes, chave, valor) VALUES (?, ?, ?, ?)
          ON CONFLICT(conta_id, mes, chave) DO UPDATE SET valor = valor + excluded.valor`,
    args: [contaId, mesAtual(), chave, n],
  });
}

/** A conta da execução atual (contexto ou sessão). */
export async function contaAtualId(): Promise<string> {
  return (await contaDoContexto()) ?? CONTA_PRINCIPAL;
}

/** Plano e recursos da conta da execução atual. */
export async function planoAtual(): Promise<{ contaId: string; plano: Plano; recursos: Recurso[] }> {
  const contaId = await contaAtualId();
  if (contaId === CONTA_PRINCIPAL) return { contaId, plano: PLANO_DONO, recursos: RECURSOS_DO_PLANO.dono };
  const conta = await lerConta(contaId);
  const plano = await planoPorId(conta?.plano ?? "essencial");
  return { contaId, plano, recursos: RECURSOS_DO_PLANO[plano.id] ?? [] };
}

/** Quantos leads novos ainda cabem no mês. `null` = sem limite. */
export async function leadsRestantes(): Promise<{ contaId: string; restantes: number | null }> {
  const { contaId, plano } = await planoAtual();
  if (plano.limites.leads_mes === null) return { contaId, restantes: null };
  const uso = await usoDoMes(contaId);
  return { contaId, restantes: Math.max(0, plano.limites.leads_mes - uso.leads) };
}

export async function exigirRecursoNaConta(recurso: Recurso): Promise<void> {
  const { recursos, plano } = await planoAtual();
  if (!recursos.includes(recurso)) {
    throw new ErroConta(`Este recurso não faz parte do plano ${plano.nome}. Veja os planos em Assinatura.`, 403);
  }
}

export type Fatura = {
  id: string;
  plano: string | null;
  valor_centavos: number;
  status: "pendente" | "paga" | "atrasada" | "estornada" | "cancelada";
  forma: string | null;
  vencimento: string | null;
  pago_em: string | null;
  link: string | null;
  criado_em: string;
};

export async function listarFaturas(contaId: string, limite = 24): Promise<Fatura[]> {
  const { rows } = await getBancoPrincipal().execute({
    sql: `SELECT id, plano, valor_centavos, status, forma, vencimento, pago_em, link, criado_em FROM faturas WHERE conta_id = ? ORDER BY COALESCE(vencimento, criado_em) DESC LIMIT ?`,
    args: [contaId, limite],
  });
  return rows.map((r) => ({ ...r }) as unknown as Fatura);
}

// ── Equipe (pessoas com login na mesma conta) ──────────────────────────

export async function listarEquipe(contaId: string): Promise<Array<Pick<Usuario, "id" | "nome" | "email" | "papel" | "ativo" | "ultimo_acesso_em">>> {
  const { rows } = await getBancoPrincipal().execute({
    sql: `SELECT id, nome, email, papel, ativo, ultimo_acesso_em FROM usuarios WHERE conta_id = ? ORDER BY papel = 'dono' DESC, criado_em`,
    args: [contaId],
  });
  return rows.map((r) => ({ ...r }) as never);
}

export async function adicionarMembro(contaId: string, e: { nome: string; email: string; senha: string }): Promise<void> {
  const conta = await lerConta(contaId);
  if (!conta) throw new ErroConta("Conta não encontrada.", 404);
  const plano = await planoPorId(conta.plano);
  const equipe = await listarEquipe(contaId);
  if (plano.limites.usuarios !== null && equipe.length >= plano.limites.usuarios) {
    throw new ErroConta(`O plano ${plano.nome} permite ${plano.limites.usuarios} pessoa(s) na conta. Mude de plano em Assinatura para chamar mais gente.`, 403);
  }
  const email = e.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroConta("E-mail inválido.");
  const fraca = senhaFraca(e.senha);
  if (fraca) throw new ErroConta(fraca);
  if (await usuarioPorEmail(email)) throw new ErroConta("Este e-mail já tem uma conta no Vynexa Leads.", 409);
  await getBancoPrincipal().execute({
    sql: `INSERT INTO usuarios (id, conta_id, nome, email, senha_hash, papel) VALUES (?, ?, ?, ?, ?, 'membro')`,
    args: [novoId(), contaId, e.nome.trim(), email, await hashSenha(e.senha)],
  });
}

export async function removerMembro(contaId: string, usuarioId: string): Promise<void> {
  const { rowsAffected } = await getBancoPrincipal().execute({
    sql: `DELETE FROM usuarios WHERE id = ? AND conta_id = ? AND papel = 'membro'`,
    args: [usuarioId, contaId],
  });
  if (rowsAffected === 0) throw new ErroConta("Pessoa não encontrada (o titular não pode ser removido).", 404);
}
