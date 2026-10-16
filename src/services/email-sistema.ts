import { comConta, CONTA_PRINCIPAL } from "@/db/contas-banco";
import { provedorEmailAtivo } from "@/integrations/email";

/**
 * E-mails do próprio SaaS (senha nova, aviso de cobrança): saem pelo
 * provedor de e-mail configurado na conta do DONO, nunca pelo do cliente.
 */
export async function enviarEmailDoSistema(m: { para: string; assunto: string; texto: string }): Promise<void> {
  await comConta(CONTA_PRINCIPAL, async () => {
    const provedor = await provedorEmailAtivo();
    const pronto = await provedor.pronto();
    if (!pronto.ok) throw new Error(`E-mail do sistema sem provedor configurado: ${pronto.motivo ?? ""}`);
    await provedor.enviar({ para: m.para, assunto: m.assunto, texto: m.texto, html: null, remetenteNome: "Vynexa Leads", responderPara: null, cabecalhos: {} });
  });
}
