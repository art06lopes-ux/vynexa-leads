import { Settings } from "lucide-react";
import { Suspense } from "react";

import { Cabecalho, Cartao } from "@/components/base/cartao";
import { BotaoNotificacoes } from "@/components/configuracoes/botao-push";
import { ConexaoGoogle } from "@/components/configuracoes/conexao-google";
import { ZerarDados } from "@/components/configuracoes/zerar";
import { Campo, CampoSegredo, Copiavel, FormConfig, Produtos, SeletorAbas, Supressao, TesteEmail, UploadLogo } from "@/components/configuracoes/abas";
import { getBanco, planos } from "@/db/cliente";
import { lerIdentidade } from "@/db/painel";
import { estadoProvedoresEmail } from "@/integrations/email";
import { estadoDosSegredos } from "@/integrations/segredos";
import { contaConectada } from "@/lib/google/oauth";
import { urlBase } from "@/services/rastreio";

export const metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes({ searchParams }: PageProps<"/configuracoes">) {
  const { aba: abaBruta } = await searchParams;
  const aba = typeof abaBruta === "string" ? abaBruta : "identidade";
  const banco = getBanco();
  const contagens =
    aba === "avancado"
      ? await getBanco()
          .execute(`SELECT (SELECT COUNT(*) FROM leads) AS leads, (SELECT COUNT(*) FROM vendas) AS vendas`)
          .then(({ rows }) => ({ leads: Number(rows[0]?.leads ?? 0), vendas: Number(rows[0]?.vendas ?? 0) }))
      : { leads: 0, vendas: 0 };
  const [identidade, segredos, provedores, conta, prods, supr, reqMes] = await Promise.all([
    lerIdentidade(),
    estadoDosSegredos(),
    estadoProvedoresEmail(),
    contaConectada().catch(() => null),
    banco.execute(`SELECT id, nome, tipo, descricao, entregaveis, preco_centavos, ordem, ativo FROM produtos ORDER BY ativo DESC, ordem, nome`),
    banco.execute(`SELECT tipo, valor, motivo, origem, criado_em FROM supressao ORDER BY criado_em DESC LIMIT 300`),
    banco.execute(`SELECT COALESCE(SUM(requisicoes),0) n FROM buscas WHERE provedor = 'google_places' AND criado_em >= date('now','start of month')`),
  ]);
  const c = identidade.config;
  const s = (nome: string) => segredos.find((x) => x.nome === nome)!;
  const base = urlBase(c.app_url);

  return (
    <div>
      <Cabecalho icone={Settings} titulo="Configurações" descricao="Identidade da Vynexa, catálogo, chaves de API, e-mail, pagamentos e privacidade." />
      <Suspense>
        <SeletorAbas />
      </Suspense>

      {aba === "identidade" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Cartao titulo="Logo" subtitulo="Aparece no painel, notificações, e-mails, propostas e cobranças">
            <UploadLogo logoUrl={identidade.logoUrl} empresa={identidade.empresa} />
          </Cartao>
          <Cartao titulo="Identidade da Vynexa">
            <FormConfig>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo nome="empresa_nome" rotulo="Nome" valor={c.empresa_nome || "Vynexa Dev"} />
                <Campo nome="responsavel_nome" rotulo="Nome do responsável" valor={c.responsavel_nome || "Artur"} />
                <Campo nome="empresa_email" rotulo="E-mail" valor={c.empresa_email} tipo="email" />
                <Campo nome="empresa_whatsapp" rotulo="WhatsApp" valor={c.empresa_whatsapp} placeholder="+55 92 99999-0000" />
                <Campo nome="empresa_instagram" rotulo="Instagram" valor={c.empresa_instagram} placeholder="@vynexadev" />
                <Campo nome="empresa_site" rotulo="Site" valor={c.empresa_site} placeholder="https://vynexa.dev" />
                <div className="flex gap-4">
                  <Campo nome="cor_primaria" rotulo="Cor principal" valor={c.cor_primaria || "#3366ff"} tipo="color" />
                  <Campo nome="cor_secundaria" rotulo="Cor secundária" valor={c.cor_secundaria || "#6fd3ff"} tipo="color" />
                </div>
              </div>
              <Campo nome="email_assinatura" rotulo="Assinatura de e-mail" valor={c.email_assinatura} linhas={4} dica="Vazia = nome, empresa, site e WhatsApp acima. Vai no fim de todo e-mail, com o logo." placeholder={"Artur · Vynexa Dev\nhttps://vynexa.dev\nWhatsApp: +55 92 …"} />
            </FormConfig>
          </Cartao>
        </div>
      )}

      {aba === "produtos" && (
        <Cartao titulo="Catálogo de produtos" subtitulo="O que a Vynexa vende">
          <Produtos produtos={planos(prods.rows)} />
        </Cartao>
      )}

      {aba === "integracoes" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <CampoSegredo
            s={s("GOOGLE_PLACES_API_KEY")}
            ajuda={
              <>
                Fonte principal de leads. Ative a <b>Places API (New)</b> no Google Cloud, crie uma chave restrita a ela (sem restrição de referer — ela só é usada no servidor). O Google exige conta de faturamento com cartão; telefone, site e avaliações caem no SKU Enterprise, com cota mensal gratuita e cobrança acima dela. Requisições neste mês: <b className="text-foreground">{Number(reqMes.rows[0]?.n ?? 0)}</b>.
              </>
            }
          />
          <CampoSegredo s={s("GEMINI_API_KEY")} ajuda={<>IA de análise e mensagens. Chave gratuita, sem cartão, em aistudio.google.com/apikey.</>} />
          <CampoSegredo s={s("RESEND_API_KEY")} ajuda={<>Envio de e-mail por API (resend.com). Exige domínio verificado; o plano gratuito envia até 100 por dia.</>} />
          <CampoSegredo s={s("SMTP_PASSWORD")} ajuda={<>Senha da caixa SMTP (Hostinger Mail ou outro). Servidor e usuário ficam na aba E-mail.</>} />
          <CampoSegredo s={s("ASAAS_API_KEY")} ajuda={<>Cobranças por Pix, boleto e cartão. Comece com a chave do sandbox; o ambiente é escolhido na aba Pagamentos.</>} />
          <CampoSegredo s={s("ASAAS_WEBHOOK_TOKEN")} ajuda={<>Invente um token longo e cole aqui E no cadastro do webhook no Asaas. Sem ele, o webhook recusa tudo.</>} />
          <CampoSegredo s={s("RESEND_WEBHOOK_SECRET")} ajuda={<>Opcional: o segredo (whsec_…) do webhook do Resend, para registrar “entregue” e “aberto”.</>} />
          <Cartao titulo="Mapa">
            <p className="text-sm text-muted-foreground">O mapa usa OpenStreetMap, sem chave. Nada a configurar.</p>
          </Cartao>
          <p className="text-xs text-muted-foreground xl:col-span-2">Chaves salvas aqui ficam cifradas no banco (AES-GCM) e nunca voltam para o navegador — a tela mostra só os quatro últimos caracteres. Variáveis de ambiente com o mesmo nome continuam valendo quando nada foi salvo aqui.</p>
        </div>
      )}

      {aba === "email" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Cartao titulo="Provedor de envio" subtitulo="Usado por campanhas e pelo envio avulso">
            <ul className="mb-4 space-y-2">
              {provedores.map((p) => (
                <li key={p.nome} className="flex items-center justify-between rounded-xl border border-fio px-3 py-2 text-sm">
                  <span className="font-medium">{p.rotulo}</span>
                  <span className={p.ok ? "text-sucesso" : "text-muted-foreground"}>{p.ok ? "Pronto" : p.motivo}</span>
                </li>
              ))}
            </ul>
            <FormConfig>
              <label className="block space-y-1.5">
                <span className="rotulo">Provedor ativo</span>
                <select name="email_provedor" defaultValue={c.email_provedor || "gmail"} className="h-10 w-full cursor-pointer rounded-xl border border-fio bg-white/[0.03] px-3 text-sm">
                  <option value="gmail">Gmail (conta conectada)</option>
                  <option value="resend">Resend (API)</option>
                  <option value="smtp">SMTP — Hostinger e outros</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo nome="email_remetente" rotulo="E-mail remetente (Resend/SMTP)" valor={c.email_remetente} placeholder="contato@vynexa.dev" />
                <Campo nome="email_resposta" rotulo="Responder para (opcional)" valor={c.email_resposta} />
                <Campo nome="smtp_host" rotulo="Servidor SMTP" valor={c.smtp_host} placeholder="smtp.hostinger.com" />
                <Campo nome="smtp_porta" rotulo="Porta" valor={c.smtp_porta || "465"} />
                <Campo nome="smtp_usuario" rotulo="Usuário SMTP" valor={c.smtp_usuario} />
                <Campo nome="email_teto_diario" rotulo="Teto diário (todas as campanhas)" valor={c.email_teto_diario || "100"} dica="Proteção de reputação: acima disto, a fila espera o dia seguinte." />
              </div>
            </FormConfig>
            <div className="mt-4">
              <TesteEmail />
            </div>
          </Cartao>
          <Cartao titulo="Gmail" subtitulo="Conexão por OAuth, só com permissão de enviar">
            <ConexaoGoogle conta={conta} />
          </Cartao>
        </div>
      )}

      {aba === "pagamentos" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Cartao titulo="Asaas">
            <FormConfig>
              <label className="block space-y-1.5">
                <span className="rotulo">Ambiente</span>
                <select name="asaas_ambiente" defaultValue={c.asaas_ambiente || "sandbox"} className="h-10 w-full cursor-pointer rounded-xl border border-fio bg-white/[0.03] px-3 text-sm">
                  <option value="sandbox">Sandbox (teste)</option>
                  <option value="producao">Produção</option>
                </select>
                <span className="block text-xs text-muted-foreground">A chave precisa ser do mesmo ambiente.</span>
              </label>
            </FormConfig>
          </Cartao>
          <Cartao titulo="Webhook do Asaas" subtitulo="Cadastre no painel do Asaas → Integrações → Webhooks">
            <div className="space-y-3 text-sm">
              <p className="rotulo">URL</p>
              <Copiavel texto={`${base}/api/webhooks/asaas`} />
              <p className="text-muted-foreground">
                Token de autenticação: o mesmo valor salvo em Integrações → “Token do webhook do Asaas”. Eventos: PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED.
              </p>
              <p className="text-muted-foreground">Quando um pagamento é confirmado, a venda vira “paga” uma única vez (eventos repetidos são ignorados) e a notificação de venda aparece.</p>
              <p className="rotulo pt-2">Webhook do Resend (opcional)</p>
              <Copiavel texto={`${base}/api/webhooks/resend`} />
            </div>
          </Cartao>
          <Cartao titulo="Aviso no celular" subtitulo="Quando você gera um link de cobrança e quando o cliente paga">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                No iPhone: abra o Vynexa Leads no Safari → Compartilhar → <strong className="text-foreground">Adicionar à Tela de Início</strong>. Abra pelo ícone
                novo (o “V” da Vynexa) e toque em ativar abaixo. Os avisos chegam na tela de bloqueio com esse ícone, mesmo com o app fechado.
              </p>
              <BotaoNotificacoes />
            </div>
          </Cartao>
        </div>
      )}

      {aba === "compliance" && (
        <Cartao titulo="Lista de supressão" subtitulo="Opt-out, bloqueio e “não contatar novamente”">
          <Supressao itens={planos(supr.rows)} />
        </Cartao>
      )}

      {aba === "avancado" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Cartao titulo="Geral">
            <FormConfig>
              <Campo nome="app_url" rotulo="Endereço público do app" valor={c.app_url} placeholder="https://vynexa-leads.vercel.app" dica="Usado nos links dos e-mails (descadastro, rastreio) e nos webhooks." />
              <Campo nome="fuso" rotulo="Fuso horário" valor={c.fuso || "America/Manaus"} dica="Ex.: America/Manaus, America/Sao_Paulo, Europe/Lisbon." />
              <Campo nome="google_teto_requisicoes" rotulo="Teto padrão de requisições por busca no Google" valor={c.google_teto_requisicoes || "10"} />
              <Campo nome="receita_ufs" rotulo="Estados importados da Receita Federal" valor={c.receita_ufs} placeholder="AM, PA" dica="Base de CNPJs usada como fonte complementar no Brasil (buscas pelo OpenStreetMap)." />
            </FormConfig>
          </Cartao>
          <Cartao titulo="Começar do zero" subtitulo="Apaga a carteira de leads e mantém as configurações">
            <ZerarDados leads={contagens.leads} vendas={contagens.vendas} />
          </Cartao>
        </div>
      )}
    </div>
  );
}
