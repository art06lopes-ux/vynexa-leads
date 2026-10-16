import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";

export const metadata: Metadata = { title: "Política de privacidade", robots: { index: true, follow: true } };

export default function PaginaPrivacidade() {
  return (
    <PaginaLegal titulo="Política de privacidade" atualizado="15 de outubro de 2026">
      <section>
        <h2>Quais dados guardamos</h2>
        <ul>
          <li>Da sua conta: nome, e-mail, WhatsApp, nome da empresa e, se você assinar, CPF ou CNPJ (exigido para emitir a cobrança).</li>
          <li>Do uso: quando você entrou, quantos leads buscou no mês e quantas análises de IA usou — para aplicar os limites do plano.</li>
          <li>Da sua carteira: as empresas, leads, mensagens e vendas que você cria. Cada conta tem um banco de dados separado; outra conta não tem como ver os seus dados.</li>
          <li>Chaves de API que você conectar ficam cifradas e nunca são mostradas de volta na tela.</li>
        </ul>
      </section>
      <section>
        <h2>O que não guardamos</h2>
        <p>Dados de cartão. O pagamento acontece na página do Asaas; nós só recebemos a confirmação.</p>
      </section>
      <section>
        <h2>Para que usamos</h2>
        <ul>
          <li>Fazer o sistema funcionar, cobrar a assinatura e aplicar os limites do plano.</li>
          <li>Mandar e-mails da conta (senha nova, cobrança). Não vendemos nem alugamos seus dados.</li>
        </ul>
      </section>
      <section>
        <h2>Dados das empresas prospectadas</h2>
        <p>
          São dados públicos de negócios (nome, endereço, telefone comercial, site) vindos do OpenStreetMap e do Google Maps. Quem pede para não ser contatado entra numa lista de bloqueio que impede novas abordagens, conforme a LGPD.
        </p>
      </section>
      <section>
        <h2>Com quem compartilhamos</h2>
        <ul>
          <li>Infraestrutura: Vercel (hospedagem) e Cloudflare (banco de dados).</li>
          <li>Pagamentos: Asaas.</li>
          <li>IA: Google Gemini, apenas com os dados públicos da empresa analisada.</li>
        </ul>
      </section>
      <section>
        <h2>Seus direitos (LGPD)</h2>
        <p>Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo suporte. Ao excluir a conta, o banco de dados dela é apagado.</p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>Usamos só o cookie necessário para manter você conectado. Não usamos cookies de anúncio.</p>
      </section>
    </PaginaLegal>
  );
}
