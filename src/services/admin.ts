import { agora, getBancoPrincipal } from "@/db/cliente";
import { apagarBancoDaConta, CONTA_PRINCIPAL, esquecerConta } from "@/db/contas-banco";
import { acessoDaConta, listarPlanos, mesAtual, type Conta } from "@/services/contas";

/**
 * Leituras do painel de membros (só o dono do SaaS). Tudo no banco
 * principal: contas, usuários, faturas e uso.
 */

export type LinhaMembro = Conta & {
  titular_nome: string | null;
  titular_email: string | null;
  ultimo_acesso_em: string | null;
  usuarios: number;
  leads_mes: number;
  liberado: boolean;
};

export async function listarMembros(filtro: { busca?: string; status?: string } = {}): Promise<LinhaMembro[]> {
  const args: Array<string> = [mesAtual()];
  let onde = `c.id <> '${CONTA_PRINCIPAL}'`;
  if (filtro.status) {
    onde += ` AND c.status = ?`;
    args.push(filtro.status);
  }
  if (filtro.busca?.trim()) {
    onde += ` AND (c.nome LIKE ? OR EXISTS (SELECT 1 FROM usuarios x WHERE x.conta_id = c.id AND (x.email LIKE ? OR x.nome LIKE ?)))`;
    const t = `%${filtro.busca.trim()}%`;
    args.push(t, t, t);
  }
  const { rows } = await getBancoPrincipal().execute({
    sql: `SELECT c.*,
            (SELECT u.nome FROM usuarios u WHERE u.conta_id = c.id AND u.papel = 'dono' ORDER BY u.criado_em LIMIT 1) AS titular_nome,
            (SELECT u.email FROM usuarios u WHERE u.conta_id = c.id AND u.papel = 'dono' ORDER BY u.criado_em LIMIT 1) AS titular_email,
            (SELECT MAX(u.ultimo_acesso_em) FROM usuarios u WHERE u.conta_id = c.id) AS ultimo_acesso_em,
            (SELECT COUNT(*) FROM usuarios u WHERE u.conta_id = c.id) AS usuarios,
            COALESCE((SELECT valor FROM uso_contas x WHERE x.conta_id = c.id AND x.mes = ? AND x.chave = 'leads'), 0) AS leads_mes
          FROM contas c WHERE ${onde} ORDER BY c.criado_em DESC LIMIT 500`,
    args,
  });
  return rows.map((r) => {
    const c = { ...r } as unknown as LinhaMembro;
    return { ...c, usuarios: Number(c.usuarios), leads_mes: Number(c.leads_mes), liberado: acessoDaConta(c).liberado };
  });
}

export type ResumoAdmin = {
  mrrCentavos: number;
  ativas: number;
  emTeste: number;
  atrasadas: number;
  canceladas: number;
  novas7d: number;
  novas30d: number;
  recebidoMesCentavos: number;
  conversao: number | null;
  porPlano: Array<{ plano: string; nome: string; ativas: number; mrrCentavos: number }>;
};

export async function resumoAdmin(): Promise<ResumoAdmin> {
  const banco = getBancoPrincipal();
  const planos = await listarPlanos();
  const [contas, recebido] = await Promise.all([
    banco.execute(`SELECT plano, status, valida_ate, criado_em, banco_tipo, id FROM contas WHERE id <> '${CONTA_PRINCIPAL}'`),
    banco.execute({ sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS t FROM faturas WHERE status = 'paga' AND substr(COALESCE(pago_em, atualizado_em), 1, 7) = ?`, args: [mesAtual()] }),
  ]);
  const agoraMs = Date.now();
  const linhas = contas.rows.map((r) => ({ ...r }) as unknown as Conta);
  const ativas = linhas.filter((c) => c.status === "ativa" && acessoDaConta(c, agoraMs).liberado);
  const desde = (dias: number) => linhas.filter((c) => Date.parse(`${c.criado_em.replace(" ", "T")}Z`) >= agoraMs - dias * 86_400_000).length;
  const pagantesHistoricos = linhas.filter((c) => c.status !== "teste").length;
  const porPlano = planos.map((p) => {
    const n = ativas.filter((c) => c.plano === p.id).length;
    return { plano: p.id, nome: p.nome, ativas: n, mrrCentavos: n * p.precoCentavos };
  });
  return {
    mrrCentavos: porPlano.reduce((t, p) => t + p.mrrCentavos, 0),
    ativas: ativas.length,
    emTeste: linhas.filter((c) => c.status === "teste" && acessoDaConta(c, agoraMs).liberado).length,
    atrasadas: linhas.filter((c) => c.status === "atrasada").length,
    canceladas: linhas.filter((c) => c.status === "cancelada").length,
    novas7d: desde(7),
    novas30d: desde(30),
    recebidoMesCentavos: Number(recebido.rows[0]?.t ?? 0),
    conversao: linhas.length > 0 ? pagantesHistoricos / linhas.length : null,
    porPlano,
  };
}

export async function usuariosDaConta(contaId: string): Promise<Array<{ id: string; nome: string; email: string; papel: string; ativo: number; ultimo_acesso_em: string | null; criado_em: string }>> {
  const { rows } = await getBancoPrincipal().execute({
    sql: `SELECT id, nome, email, papel, ativo, ultimo_acesso_em, criado_em FROM usuarios WHERE conta_id = ? ORDER BY papel = 'dono' DESC, criado_em`,
    args: [contaId],
  });
  return rows.map((r) => ({ ...r }) as never);
}

export async function usoHistorico(contaId: string): Promise<Array<{ mes: string; leads: number; ia: number }>> {
  const { rows } = await getBancoPrincipal().execute({
    sql: `SELECT mes, SUM(CASE WHEN chave = 'leads' THEN valor ELSE 0 END) AS leads, SUM(CASE WHEN chave = 'ia' THEN valor ELSE 0 END) AS ia
          FROM uso_contas WHERE conta_id = ? GROUP BY mes ORDER BY mes DESC LIMIT 6`,
    args: [contaId],
  });
  return rows.map((r) => ({ mes: String(r.mes), leads: Number(r.leads), ia: Number(r.ia) }));
}

/** Exclui a conta: usuários, faturas e uso (cascata) e o banco dela no D1. Sem volta. */
export async function excluirConta(contaId: string): Promise<void> {
  if (contaId === CONTA_PRINCIPAL) throw new Error("A conta do dono não pode ser excluída.");
  const banco = getBancoPrincipal();
  const { rows } = await banco.execute({ sql: `SELECT banco_tipo, banco_ref FROM contas WHERE id = ?`, args: [contaId] });
  if (!rows[0]) return;
  await banco.batch(
    [
      { sql: `DELETE FROM usuarios WHERE conta_id = ?`, args: [contaId] },
      { sql: `DELETE FROM faturas WHERE conta_id = ?`, args: [contaId] },
      { sql: `DELETE FROM uso_contas WHERE conta_id = ?`, args: [contaId] },
      { sql: `DELETE FROM contas WHERE id = ?`, args: [contaId] },
    ],
    "write",
  );
  esquecerConta(contaId);
  await apagarBancoDaConta({ tipo: String(rows[0].banco_tipo), ref: rows[0].banco_ref ? String(rows[0].banco_ref) : null }).catch((e) =>
    console.error("[admin] apagar banco da conta:", e instanceof Error ? e.message : e),
  );
}

export async function salvarConfigSaas(chave: "saas_teste_dias" | "saas_whatsapp_suporte", valor: string): Promise<void> {
  await getBancoPrincipal().execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [chave, valor, agora()],
  });
}

export async function lerConfigSaas(): Promise<{ testeDias: number; whatsappSuporte: string }> {
  const { rows } = await getBancoPrincipal().execute(`SELECT chave, valor FROM configuracoes WHERE chave IN ('saas_teste_dias', 'saas_whatsapp_suporte')`);
  const v = (c: string) => rows.find((r) => r.chave === c)?.valor;
  const dias = Number(v("saas_teste_dias"));
  return { testeDias: Number.isFinite(dias) && v("saas_teste_dias") != null ? dias : 7, whatsappSuporte: String(v("saas_whatsapp_suporte") ?? "") };
}
