import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CONTA_PRINCIPAL } from "@/db/contas-banco";
import { lerSessao, NOME_COOKIE } from "@/lib/auth";
import { PLANO_DONO, RECURSOS_DO_PLANO, type Plano, type Recurso } from "@/lib/planos";
import { acessoDaConta, lerConta, lerUsuario, planoPorId, type Acesso, type Conta } from "@/services/contas";

/**
 * Quem está usando o sistema, com a conta, o plano e se o acesso está
 * liberado. Segunda camada da tranca: o proxy já barra a navegação, mas
 * o `matcher` é uma expressão regular e uma rota nova pode escapar dele.
 */

export type SessaoAtual = {
  usuario: { id: string | null; nome: string; email: string | null; papel: "dono" | "membro"; admin: boolean };
  conta: Conta;
  plano: Plano;
  recursos: Recurso[];
  acesso: Acesso;
  /** É o dono do SaaS (acesso total + painel de membros). */
  ehDono: boolean;
};

/** Conta do dono como objeto, para o cookie antigo (senha única) e para quando a tabela ainda não existe. */
function contaPrincipalPadrao(): Conta {
  return {
    id: CONTA_PRINCIPAL,
    nome: "Vynexa",
    plano: "dono",
    status: "ativa",
    valida_ate: null,
    banco_tipo: "principal",
    documento: null,
    telefone: null,
    asaas_cliente_id: null,
    asaas_assinatura_id: null,
    origem: null,
    observacao: null,
    criado_em: "",
    cancelada_em: null,
  };
}

export const sessaoAtual = cache(async (): Promise<SessaoAtual | null> => {
  const sessao = await lerSessao((await cookies()).get(NOME_COOKIE)?.value);
  if (!sessao) return null;

  if (sessao.conta === CONTA_PRINCIPAL) {
    const usuario = sessao.usuario ? await lerUsuario(sessao.usuario).catch(() => null) : null;
    if (sessao.usuario && (!usuario || !usuario.ativo)) return null;
    const conta = (await lerConta(CONTA_PRINCIPAL).catch(() => null)) ?? contaPrincipalPadrao();
    return {
      usuario: { id: usuario?.id ?? null, nome: usuario?.nome ?? "Dono", email: usuario?.email ?? null, papel: "dono", admin: true },
      conta,
      plano: PLANO_DONO,
      recursos: RECURSOS_DO_PLANO.dono,
      acesso: { liberado: true },
      ehDono: true,
    };
  }

  if (!sessao.usuario) return null;
  const [usuario, conta] = await Promise.all([lerUsuario(sessao.usuario), lerConta(sessao.conta)]);
  if (!usuario || !usuario.ativo || !conta || usuario.conta_id !== conta.id) return null;
  const plano = await planoPorId(conta.plano);
  return {
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, admin: Boolean(usuario.admin) },
    conta,
    plano,
    recursos: RECURSOS_DO_PLANO[plano.id] ?? [],
    acesso: acessoDaConta(conta),
    ehDono: false,
  };
});

export async function temSessao(): Promise<boolean> {
  return (await sessaoAtual()) !== null;
}

/** Para páginas: manda ao login quando não há sessão. */
export async function exigirSessao(): Promise<SessaoAtual> {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  return s;
}

/** Para telas de plano acima: sem o recurso, vai para Assinatura explicando o que libera. */
export async function exigirRecursoNaPagina(recurso: Recurso): Promise<SessaoAtual> {
  const s = await exigirSessao();
  if (!s.acesso.liberado) redirect("/assinatura");
  if (!s.recursos.includes(recurso)) redirect(`/assinatura?recurso=${recurso}`);
  return s;
}

/** Para páginas só do dono do SaaS. */
export async function exigirDono(): Promise<SessaoAtual> {
  const s = await exigirSessao();
  if (!s.ehDono) redirect("/");
  return s;
}

/**
 * Para rotas de API: 401 sem sessão; 402 com a assinatura vencida
 * (a não ser nas rotas que existem justamente para regularizar).
 */
export async function exigirSessaoNaApi(opcoes: { mesmoVencida?: boolean } = {}): Promise<Response | null> {
  const s = await sessaoAtual();
  if (!s) return Response.json({ erro: "Não autenticado." }, { status: 401 });
  if (!s.acesso.liberado && !opcoes.mesmoVencida) {
    return Response.json({ erro: "Sua assinatura não está ativa. Regularize em Assinatura para continuar.", codigo: "assinatura" }, { status: 402 });
  }
  return null;
}

/** Para rotas de API só do dono do SaaS. */
export async function exigirDonoNaApi(): Promise<Response | null> {
  const s = await sessaoAtual();
  if (!s) return Response.json({ erro: "Não autenticado." }, { status: 401 });
  if (!s.ehDono) return Response.json({ erro: "Só o administrador pode fazer isto." }, { status: 403 });
  return null;
}
