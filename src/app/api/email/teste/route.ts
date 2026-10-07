import { getBanco } from "@/db/cliente";
import { provedorEmailAtivo } from "@/integrations/email";
import { ErroApi, json, limitar, rota } from "@/server/api";
import { comporEmail } from "@/services/composicao-email";
import { carregarIdentidade } from "@/services/envio";

/** Manda um e-mail de teste para o próprio e-mail da Vynexa (Identidade). */
export const POST = rota(async () => {
  await limitar("email-teste", 10, 3600);
  const banco = getBanco();
  const { identidade, base, config } = await carregarIdentidade(banco);
  const para = config.empresa_email;
  if (!para) throw new ErroApi("Preencha o e-mail da Vynexa em Identidade para receber o teste.");
  const provedor = await provedorEmailAtivo();
  const pronto = await provedor.pronto();
  if (!pronto.ok) throw new ErroApi(`${provedor.rotulo}: ${pronto.motivo}`, 409, "sem_configuracao");

  const { texto, html } = comporEmail(
    "Este é um e-mail de teste do Vynexa Leads.\n\nSe chegou na caixa de entrada (e não no spam), o provedor está configurado corretamente.",
    identidade,
    { pixel: null, descadastro: `${base}/descadastro/teste`, rastrearLink: null },
    "pt-BR",
  );
  try {
    const r = await provedor.enviar({ para, assunto: "Teste de envio — Vynexa Leads", texto, html, remetenteNome: `${identidade.responsavelNome} · ${identidade.empresaNome}`, responderPara: null, cabecalhos: {} });
    return json({ ok: true, para, provedor: provedor.rotulo, id: r.id });
  } catch (e) {
    throw new ErroApi(`O envio falhou: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
});
