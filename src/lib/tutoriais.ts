/**
 * Tutoriais da aba Ajuda. Conteúdo em código (não no banco) de propósito:
 * muda junto com o produto, passa por revisão e não some num "zerar".
 * `video` aceita um link do YouTube (ou de um corte da live) quando houver.
 */

export type Passo = { titulo: string; texto: string; link?: { rotulo: string; href: string }; dica?: string };

export type Tutorial = {
  slug: string;
  titulo: string;
  resumo: string;
  minutos: number;
  grupo: "Comece aqui" | "Prospecção" | "Chaves e integrações" | "Conta";
  passos: Passo[];
  video?: string;
  soDono?: boolean;
};

export const TUTORIAIS: Tutorial[] = [
  {
    slug: "primeiros-passos",
    titulo: "Primeiros passos",
    resumo: "Do cadastro à primeira mensagem enviada, em cinco minutos.",
    minutos: 5,
    grupo: "Comece aqui",
    passos: [
      { titulo: "Preencha a sua identidade", texto: "Em Configurações → Identidade, coloque o nome da sua empresa, o seu nome, WhatsApp e site. É isso que vai nas mensagens e nos e-mails.", link: { rotulo: "Abrir Identidade", href: "/configuracoes?aba=identidade" } },
      { titulo: "Diga o que você vende", texto: "Em Configurações → Produtos, cadastre o que você oferece (site institucional, landing page, cardápio digital…) com o preço. A IA usa essa lista para sugerir a oferta certa para cada empresa.", link: { rotulo: "Abrir Produtos", href: "/configuracoes?aba=produtos" } },
      { titulo: "Faça a primeira busca", texto: "No Radar, escolha um nicho (barbearia, hamburgueria, clínica…), marque a área no mapa e toque em mapear. Em poucos segundos as empresas aparecem com a situação de cada uma.", link: { rotulo: "Abrir o Radar", href: "/buscar" } },
      { titulo: "Escolha por quem começar", texto: "Em Leads, a lista já vem ordenada pela nota. Comece pelos de nota mais alta: são os que não têm site e têm contato ativo." },
      { titulo: "Aborde pelo WhatsApp", texto: "Abra o lead, confira a mensagem sugerida, ajuste se quiser e toque em WhatsApp. A conversa abre no seu celular com o texto pronto — quem envia é você.", dica: "Comece com 10 a 20 mensagens por dia. Volume alto logo no começo é o que faz o WhatsApp bloquear números." },
    ],
  },
  {
    slug: "primeira-busca",
    titulo: "Mapeando empresas no Radar",
    resumo: "Nicho, área no mapa, raio e as duas fontes de dados.",
    minutos: 4,
    grupo: "Prospecção",
    passos: [
      { titulo: "Escolha o nicho", texto: "Digite o tipo de negócio no campo de busca. Seja específico: “hamburgueria” traz resultado melhor do que “comida”." },
      { titulo: "Marque a área", texto: "Toque no mapa para posicionar o círculo e ajuste o raio. Você pode marcar até três áreas por busca — bom para bairros diferentes da mesma cidade." },
      { titulo: "Escolha a fonte", texto: "OpenStreetMap é grátis e está em todos os planos. Google Maps (PRO e Agência) traz mais empresas, com telefone, site e avaliações — e usa a sua chave do Google.", link: { rotulo: "Criar a chave do Google", href: "/tutoriais/chave-google" } },
      { titulo: "Acompanhe o resultado", texto: "A busca mostra quantas empresas apareceram, quantas são novas e quantas não têm site. Os leads novos entram direto na lista, já com nota." },
      { titulo: "Repita sem medo", texto: "Empresas que já estão na sua carteira não entram duas vezes: o sistema reconhece pelo telefone, site e endereço e só completa o que faltava." },
    ],
  },
  {
    slug: "entender-score",
    titulo: "A nota e os selos de cada lead",
    resumo: "Por que uma empresa tem 92 e outra 40 — e o que cada selo quer dizer.",
    minutos: 3,
    grupo: "Prospecção",
    passos: [
      { titulo: "A nota vai de 0 a 100", texto: "Quanto maior, mais chance de a empresa precisar de um site e de responder. Pesa: não ter site, ter WhatsApp, ter boas avaliações, estar aberta e ter e-mail." },
      { titulo: "Sem site", texto: "Nada foi encontrado além do telefone. É o lead mais quente para quem vende site." },
      { titulo: "Só Instagram / link na bio", texto: "O endereço que aparece é um perfil de rede social ou uma página de links (Linktree, contate.me…). Conta como sem site próprio." },
      { titulo: "Só cardápio online", texto: "Restaurante, hamburgueria, açaí ou pizzaria cujo “site” é a página do iFood, Anota Aí, Brendi, Goomer ou parecido. Também pega domínio próprio que só redireciona para o cardápio." },
      { titulo: "Só agenda online", texto: "Barbearia, salão ou estética que só tem a página de agendamento (AppBarber, Trinks, Booksy…). Também conta como sem site próprio." },
      { titulo: "Tem site", texto: "A empresa tem site próprio. O sistema visita e avalia: lento, sem versão de celular, sem HTTPS ou sem botão de WhatsApp vira argumento para uma reforma." },
    ],
  },
  {
    slug: "abordar-whatsapp",
    titulo: "Abordagem pelo WhatsApp sem ser bloqueado",
    resumo: "Ritmo, texto e o que fazer quando a pessoa responde.",
    minutos: 4,
    grupo: "Prospecção",
    passos: [
      { titulo: "Mande pouco e todo dia", texto: "Comece com 10 a 20 contatos por dia e aumente aos poucos. Números novos que disparam muitas mensagens iguais são os primeiros a ser bloqueados." },
      { titulo: "Use o fato encontrado", texto: "A mensagem sugerida cita o que foi visto (“a agenda de vocês fica só no app”). É isso que separa a sua abordagem de spam. Troque palavras para não mandar o mesmo texto para todos." },
      { titulo: "Registre o que aconteceu", texto: "Respondeu? Arraste no CRM para “Respondeu”. Pediu para não receber mais? Marque “Não contatar”: a empresa não aparece de novo em nenhuma busca." },
      { titulo: "Mostre um exemplo", texto: "Quem responde quase sempre pergunta “quanto custa?”. Tenha um site de exemplo do mesmo nicho para mandar junto com o preço." },
    ],
  },
  {
    slug: "crm",
    titulo: "CRM: do primeiro contato à venda",
    resumo: "Etapas, valor previsto e lembretes de quem está parado.",
    minutos: 3,
    grupo: "Prospecção",
    passos: [
      { titulo: "Cada coluna é uma etapa", texto: "Abordado, Respondeu, Negociando, Fechado. Arraste o cartão conforme a conversa anda." },
      { titulo: "Coloque o valor", texto: "No cartão, informe quanto vale a proposta. O topo do CRM soma o valor previsto de tudo que está em negociação." },
      { titulo: "Veja quem esfriou", texto: "O CRM destaca quem está parado há dias. Uma mensagem curta de retorno costuma destravar." },
    ],
  },
  {
    slug: "chave-google",
    titulo: "Criar a sua chave do Google Maps",
    resumo: "Para buscar no Google Maps (PRO e Agência). O Google dá uma cota grátis por mês.",
    minutos: 10,
    grupo: "Chaves e integrações",
    passos: [
      { titulo: "Entre no Google Cloud", texto: "Acesse console.cloud.google.com com a sua conta Google.", link: { rotulo: "Abrir o Google Cloud", href: "https://console.cloud.google.com" } },
      { titulo: "Crie um projeto", texto: "No topo, toque em “Selecionar projeto” → “Novo projeto”. Dê um nome (ex.: Vynexa Leads) e crie." },
      { titulo: "Ative o faturamento", texto: "Menu → Faturamento → vincule uma conta de faturamento. O Google pede cartão mesmo para usar a cota gratuita; sem isso a chave não funciona.", dica: "O Google cobra só o que passar da cota grátis do mês. Os próximos passos colocam travas para isso não acontecer." },
      { titulo: "Ative a Places API (New)", texto: "Menu → APIs e serviços → Biblioteca → procure “Places API (New)” → Ativar." },
      { titulo: "Crie a chave", texto: "APIs e serviços → Credenciais → Criar credenciais → Chave de API. Copie a chave que aparecer." },
      { titulo: "Restrinja a chave", texto: "Ainda em Credenciais, abra a chave → Restrições de API → “Restringir chave” → marque só “Places API (New)” e salve. Em “Restrições de aplicativo”, deixe “Nenhuma”: quem usa a chave é o servidor do Vynexa, não o seu navegador." },
      { titulo: "Coloque uma trava diária", texto: "APIs e serviços → Places API (New) → Cotas. Limite as requisições de Text Search por dia (ex.: 30). Em Faturamento → Orçamentos e alertas, crie um alerta de valor baixo (ex.: R$ 10).", dica: "Cada requisição traz até 20 empresas. O Vynexa também conta o seu uso e para de buscar ao chegar no limite do mês (ajustável em Configurações → Avançado)." },
      { titulo: "Cole no Vynexa", texto: "Configurações → Integrações → Google Places API → cole e salve. A chave fica cifrada e só os 4 últimos caracteres aparecem na tela.", link: { rotulo: "Abrir Integrações", href: "/configuracoes?aba=integracoes" } },
    ],
  },
  {
    slug: "chave-gemini",
    titulo: "IA sem limite com a sua chave do Gemini",
    resumo: "Grátis e sem cartão. Tira o limite mensal de IA do plano.",
    minutos: 2,
    grupo: "Chaves e integrações",
    passos: [
      { titulo: "Abra o Google AI Studio", texto: "Entre com a sua conta Google em aistudio.google.com/apikey.", link: { rotulo: "Abrir o AI Studio", href: "https://aistudio.google.com/apikey" } },
      { titulo: "Crie a chave", texto: "Toque em “Create API key”, escolha um projeto (ou deixe criar um) e copie a chave." },
      { titulo: "Cole no Vynexa", texto: "Configurações → Integrações → Gemini (IA) → cole e salve. A partir daí, as análises e mensagens usam a sua chave, sem contar no limite do plano.", link: { rotulo: "Abrir Integrações", href: "/configuracoes?aba=integracoes" } },
    ],
  },
  {
    slug: "email-campanhas",
    titulo: "Campanhas de e-mail",
    resumo: "Ligar o Gmail ou um SMTP e mandar em lote com segurança.",
    minutos: 5,
    grupo: "Chaves e integrações",
    passos: [
      { titulo: "Escolha como enviar", texto: "Em Configurações → E-mail: conecte o Gmail (mais simples) ou use o SMTP da sua hospedagem com um e-mail do seu domínio (melhor entrega).", link: { rotulo: "Abrir E-mail", href: "/configuracoes?aba=email" } },
      { titulo: "Teste antes", texto: "Use o botão de e-mail de teste e confira se chegou na caixa de entrada, não no spam." },
      { titulo: "Monte a campanha", texto: "Em Campanhas, escolha os leads com e-mail, revise o texto e autorize o envio. O sistema respeita um teto diário para proteger a reputação do seu e-mail." },
      { titulo: "Descadastro automático", texto: "Todo e-mail sai com o link “não quero receber”. Quem clica vai para a lista de Não contatar e nunca mais recebe nada." },
    ],
  },
  {
    slug: "notificacoes-celular",
    titulo: "Avisos no celular",
    resumo: "Saiba na hora quando uma busca termina ou um lead responde.",
    minutos: 2,
    grupo: "Conta",
    passos: [
      { titulo: "No Android", texto: "Abra o Vynexa no Chrome, vá em Configurações → Avançado → Aviso no celular → Ativar e permita as notificações." },
      { titulo: "No iPhone", texto: "Abra no Safari → botão Compartilhar → “Adicionar à Tela de Início”. Abra pelo ícone novo e ative em Configurações → Avançado. A Apple só entrega aviso de site instalado assim (iOS 16.4 ou mais novo)." },
      { titulo: "Teste", texto: "Depois de ativar, mande um aviso de teste. Se não chegar, confira se o modo Foco ou Não perturbe está ligado." },
    ],
  },
  {
    slug: "equipe",
    titulo: "Colocar a equipe na conta",
    resumo: "Mais pessoas trabalhando a mesma carteira de leads.",
    minutos: 2,
    grupo: "Conta",
    passos: [
      { titulo: "Adicione a pessoa", texto: "Configurações → Equipe → nome, e-mail e uma senha provisória. Passe a senha para a pessoa; ela pode trocar em “Esqueci a senha”.", link: { rotulo: "Abrir Equipe", href: "/configuracoes?aba=equipe" } },
      { titulo: "Tudo é compartilhado", texto: "Todos veem os mesmos leads, o mesmo CRM e as mesmas buscas. Só o titular mexe na assinatura e na equipe." },
    ],
  },
  {
    slug: "assinatura",
    titulo: "Assinar, trocar de plano ou cancelar",
    resumo: "Pix, boleto ou cartão. Sem fidelidade.",
    minutos: 2,
    grupo: "Conta",
    passos: [
      { titulo: "Assinar", texto: "Em Assinatura, escolha o plano, informe CPF ou CNPJ e toque em pagar. A página do Asaas abre com Pix, boleto e cartão. Pagou, o plano libera sozinho.", link: { rotulo: "Abrir Assinatura", href: "/assinatura" } },
      { titulo: "Trocar de plano", texto: "Escolha outro plano na mesma tela. O valor novo vale a partir da próxima cobrança." },
      { titulo: "Cancelar", texto: "No fim da tela Assinatura. Você continua usando até o fim do período pago, e seus dados ficam guardados se quiser voltar." },
    ],
  },
  {
    slug: "ligar-cobranca",
    titulo: "Ligar a cobrança das assinaturas (Asaas)",
    resumo: "Só para você, dono do Vynexa: receber dos assinantes automaticamente.",
    minutos: 8,
    grupo: "Conta",
    soDono: true,
    passos: [
      { titulo: "Pegue a chave de produção", texto: "No Asaas: Integrações → Chave de API → gerar. Copie a chave de PRODUÇÃO (a de sandbox só serve para teste)." },
      { titulo: "Cole no Vynexa", texto: "Configurações → Integrações → Asaas → cole. Em Configurações → Pagamentos, mude o ambiente para Produção.", link: { rotulo: "Abrir Integrações", href: "/configuracoes?aba=integracoes" } },
      { titulo: "Invente o token do webhook", texto: "Configurações → Integrações → “Token do webhook do Asaas”: cole uma senha longa e aleatória. Guarde: ela vai no próximo passo." },
      { titulo: "Cadastre o webhook no Asaas", texto: "No Asaas: Integrações → Webhooks → Adicionar. URL: o endereço mostrado em Configurações → Pagamentos (termina em /api/webhooks/asaas). Token: o mesmo do passo anterior. Marque os eventos de Cobrança (PAYMENT_…) e de Assinatura (SUBSCRIPTION_…). Salve ativo." },
      { titulo: "Teste com você mesmo", texto: "Crie uma conta de teste pela página de cadastro, assine o plano mais barato e pague. Em segundos chega o aviso “Pagamento recebido” no seu celular e a conta aparece como Ativa no Painel de membros." },
    ],
  },
];

export function tutorialPorSlug(slug: string): Tutorial | undefined {
  return TUTORIAIS.find((t) => t.slug === slug);
}

export function tutoriaisVisiveis(ehDono: boolean): Tutorial[] {
  return TUTORIAIS.filter((t) => !t.soDono || ehDono);
}
