import "server-only";

import { agora, getBanco } from "@/db/cliente";

/**
 * Ajustes editáveis pela interface.
 *
 * Só o que pode mudar sem redeploy mora aqui. Credencial continua em
 * variável de ambiente: guardar chave da Stripe no banco aumentaria a
 * superfície exposta sem ganhar nada — quem lê o banco passaria a ler a
 * chave também.
 */

export async function lerConfiguracoes(): Promise<Record<string, string>> {
  const { rows } = await getBanco().execute(`SELECT chave, valor FROM configuracoes`);
  return Object.fromEntries(rows.map((r) => [String(r.chave), String(r.valor)]));
}

export async function lerConfiguracao(chave: string, padrao = ""): Promise<string> {
  const { rows } = await getBanco().execute({
    sql: `SELECT valor FROM configuracoes WHERE chave = ?`,
    args: [chave],
  });
  return rows[0] ? String(rows[0].valor) : padrao;
}

export async function gravarConfiguracao(chave: string, valor: string): Promise<void> {
  await getBanco().execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [chave, valor, agora()],
  });
}

export type EstadoIntegracao = {
  nome: string;
  ligada: boolean;
  detalhe: string;
};

/**
 * Diagnóstico das integrações.
 *
 * Reporta apenas se a variável existe — **nunca o valor**. O objetivo é
 * responder "por que isso não está funcionando?" sem transformar a tela
 * de ajustes num vazamento de credenciais.
 *
 * Gemini e OpenStreetMap são caso à parte: as chaves deles vivem no
 * worker do GitHub Actions, não na Vercel, e este código roda na Vercel.
 * Conferir `process.env` aqui diria "faltando" mesmo com tudo certo —
 * foi o que aconteceu. Para esses dois, o diagnóstico olha a evidência
 * no banco: se um job rodou e deu certo, a chave existe onde importa.
 */
export async function diagnosticarIntegracoes(): Promise<EstadoIntegracao[]> {
  const tem = (nome: string) => (process.env[nome] ?? "").trim() !== "";
  const chaveStripe = (process.env.STRIPE_SECRET_KEY ?? "").trim();

  const banco = getBanco();
  const [{ rows: ia }, { rows: busca }] = await Promise.all([
    banco.execute(`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE analisado_em IS NOT NULL)                  AS analisadas,
        (SELECT MAX(analisado_em) FROM leads)                                          AS ultima,
        (SELECT erro FROM jobs WHERE tipo = 'analise_ia' AND status = 'erro'
           ORDER BY atualizado_em DESC LIMIT 1)                                        AS ultimo_erro,
        (SELECT COUNT(*) FROM jobs WHERE tipo = 'analise_ia' AND status = 'pendente') AS na_fila
    `),
    banco.execute(`
      SELECT
        (SELECT MAX(concluido_em) FROM buscas WHERE status = 'concluida') AS ultima,
        (SELECT erro FROM buscas WHERE status = 'erro' ORDER BY criado_em DESC LIMIT 1) AS ultimo_erro
    `),
  ]);

  const analisadas = Number(ia[0]?.analisadas ?? 0);
  const ultimaIa = ia[0]?.ultima ? String(ia[0].ultima) : null;
  const erroIa = ia[0]?.ultimo_erro ? String(ia[0].ultimo_erro) : null;
  const naFila = Number(ia[0]?.na_fila ?? 0);

  const ultimaBusca = busca[0]?.ultima ? String(busca[0].ultima) : null;
  const erroBusca = busca[0]?.ultimo_erro ? String(busca[0].ultimo_erro) : null;

  const quando = (iso: string) => iso.slice(0, 16).replace("T", " ");

  return [
    {
      nome: "Banco (Turso)",
      ligada: tem("TURSO_DATABASE_URL"),
      detalhe: "Conectado — esta página não carregaria sem isso.",
    },
    {
      nome: "Worker de caçadas (GitHub Actions)",
      ligada: ultimaBusca !== null,
      detalhe:
        ultimaBusca !== null
          ? `Última caçada concluída em ${quando(ultimaBusca)}.`
          : erroBusca
            ? `A última caçada falhou: ${erroBusca}`
            : "Nenhuma caçada concluída ainda. Faça uma e dispare o worker em Actions.",
    },
    {
      nome: "Análise de IA (Gemini)",
      ligada: analisadas > 0,
      detalhe:
        analisadas > 0
          ? `${analisadas} empresa(s) analisada(s). Última em ${quando(ultimaIa!)}.`
          : erroIa
            ? `A última análise falhou no worker: ${erroIa}`
            : naFila > 0
              ? `${naFila} job(s) na fila. O worker roda a cada 5 minutos.`
              : "Nenhuma análise executada ainda. A chave vive no worker (GitHub), não aqui — use o botão \"Analisar com IA\" no painel.",
    },
    {
      nome: "Checkout (Stripe)",
      ligada: chaveStripe !== "",
      detalhe:
        chaveStripe === ""
          ? "STRIPE_SECRET_KEY ausente — não é possível gerar link de cobrança."
          : chaveStripe.startsWith("sk_test_")
            ? "Modo de TESTE: pagamentos simulados, nenhum dinheiro entra."
            : "Modo de produção.",
    },
    {
      nome: "Webhook da Stripe",
      ligada: tem("STRIPE_WEBHOOK_SECRET"),
      detalhe: tem("STRIPE_WEBHOOK_SECRET")
        ? "Assinatura conferida a cada evento."
        : "Sem STRIPE_WEBHOOK_SECRET, as vendas por cartão não são confirmadas sozinhas.",
    },
    {
      nome: "Notificações push",
      ligada: tem("VAPID_PUBLIC_KEY") && tem("VAPID_PRIVATE_KEY"),
      detalhe:
        tem("VAPID_PUBLIC_KEY") && tem("VAPID_PRIVATE_KEY")
          ? "Chaves presentes. Ative por aparelho acima."
          : "Faltam VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY — gere com npm run push:chaves.",
    },
  ];
}
