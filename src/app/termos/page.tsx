import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";

export const metadata: Metadata = { title: "Termos de uso", robots: { index: true, follow: true } };

export default function PaginaTermos() {
  return (
    <PaginaLegal titulo="Termos de uso" atualizado="15 de outubro de 2026">
      <section>
        <h2>1. O que é o Vynexa Leads</h2>
        <p>
          O Vynexa Leads é um sistema online de prospecção comercial. Ele reúne dados públicos de empresas (OpenStreetMap e, quando você conecta a sua chave, a API oficial do Google Maps), analisa a presença digital de cada uma e ajuda você a organizar a abordagem e as vendas.
        </p>
      </section>
      <section>
        <h2>2. Conta e acesso</h2>
        <ul>
          <li>Você é responsável pelas informações do cadastro e por manter a sua senha em segredo.</li>
          <li>O titular da conta responde pelas pessoas que adicionar à equipe.</li>
          <li>Podemos suspender contas usadas para spam, fraude ou qualquer atividade ilegal.</li>
        </ul>
      </section>
      <section>
        <h2>3. Planos, teste e pagamento</h2>
        <ul>
          <li>Os planos são mensais, com os limites mostrados na página de planos. O teste grátis, quando oferecido, não exige cartão.</li>
          <li>A cobrança é feita pelo Asaas (Pix, boleto ou cartão) e renova a cada mês até você cancelar.</li>
          <li>Você pode cancelar a qualquer momento pela tela Assinatura. O acesso continua até o fim do período já pago; não há multa nem reembolso proporcional do mês em curso.</li>
          <li>Se o pagamento atrasar, o acesso é pausado depois de alguns dias. Os seus dados ficam guardados e voltam quando a assinatura é regularizada.</li>
          <li>Preços e limites podem mudar; mudanças de preço valem a partir da cobrança seguinte e são avisadas com antecedência.</li>
        </ul>
      </section>
      <section>
        <h2>4. Uso correto</h2>
        <ul>
          <li>O sistema sugere mensagens; quem decide e envia é você, pelo seu WhatsApp ou e-mail. Você é responsável pelo conteúdo e pelo volume do que envia.</li>
          <li>Respeite quem pedir para não ser contatado. O sistema mantém uma lista de “não contatar” que bloqueia novas abordagens.</li>
          <li>Não é permitido revender o acesso, tentar burlar limites do plano ou usar o sistema para coletar dados de forma abusiva.</li>
          <li>Chaves de API que você conectar (Google, Gemini, e-mail, Asaas) são suas; os custos que o provedor cobrar delas são seus.</li>
        </ul>
      </section>
      <section>
        <h2>5. Dados das empresas</h2>
        <p>
          As informações exibidas vêm de fontes públicas e podem estar desatualizadas ou incompletas. Não garantimos que todo dado esteja correto nem resultados de venda. Use o sistema como apoio à sua decisão.
        </p>
      </section>
      <section>
        <h2>6. Disponibilidade e responsabilidade</h2>
        <p>
          Trabalhamos para manter o sistema no ar, mas podem ocorrer interrupções, inclusive de serviços de terceiros (Google, OpenStreetMap, provedores de e-mail e de pagamento). A nossa responsabilidade fica limitada ao valor pago nos últimos três meses.
        </p>
      </section>
      <section>
        <h2>7. Encerramento</h2>
        <p>Você pode pedir a exclusão da conta e de todos os dados a qualquer momento pelo suporte. Contas canceladas há mais de 90 dias podem ser apagadas.</p>
      </section>
      <section>
        <h2>8. Contato</h2>
        <p>Dúvidas sobre estes termos: fale com o suporte pelo WhatsApp informado na página inicial.</p>
      </section>
    </PaginaLegal>
  );
}
