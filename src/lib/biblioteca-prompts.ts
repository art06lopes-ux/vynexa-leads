/**
 * Prompts prontos para o trabalho que a Vynexa repete — prévias para
 * abordagem, sites de negócio local, painéis, ajustes. Escritos para
 * colar no Claude Code; os colchetes [PREENCHER] são o que muda a cada
 * cliente.
 */

export type PromptPronto = { id: string; titulo: string; quando: string; texto: string };

export const BIBLIOTECA_PROMPTS: PromptPronto[] = [
  {
    id: "previa-abordagem",
    titulo: "Prévia de site para abordar um lead",
    quando: "Antes de mandar a primeira mensagem: o cliente vê o próprio site pronto.",
    texto: `Crie uma prévia de site para [PREENCHER: nome da empresa], um(a) [PREENCHER: segmento] em [PREENCHER: cidade/UF], para eu mostrar na abordagem de venda.

## Contexto
- Projeto novo em Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion, para publicar na Vercel.
- Dados reais que tenho: [PREENCHER: Instagram, endereço, telefone/WhatsApp, horários, serviços]. Use só esses. Onde faltar informação, deixe um texto neutro e marque com um comentário TODO — não invente preço, depoimento nem número de clientes.
- Fotos: [PREENCHER: pasta com as fotos do Instagram do cliente]. Otimize (WebP, tamanhos responsivos).

## O que construir
- Uma página única com: abertura forte com a melhor foto e o nome, serviços, diferenciais, galeria, localização com mapa, horário e um botão de WhatsApp fixo no celular.
- Identidade visual tirada das cores e do estilo do Instagram do cliente — nada de template genérico.
- Textos curtos, em português do Brasil, falando com o cliente final do negócio.

## Critérios de aceite
- Abre bem em 375 px de largura sem rolagem horizontal; botões com pelo menos 44 px de altura.
- Contraste de texto AA; imagens com texto alternativo.
- Botão de WhatsApp abre wa.me com mensagem pronta.

## Entrega e verificação
- Rode o projeto, confira no navegador em celular e desktop, corrija o que quebrar.
- Publique na Vercel e me passe o link e uma mensagem curta de abordagem para eu mandar com ele.`,
  },
  {
    id: "delivery-cardapio",
    titulo: "Delivery com cardápio e pedido no WhatsApp",
    quando: "Restaurante, lanchonete, confeitaria ou espetinho.",
    texto: `Crie um site de delivery para [PREENCHER: nome], em [PREENCHER: cidade], com o cardápio completo visível na página inicial (sem esconder atrás de botões).

## Requisitos
- Categorias com rolagem horizontal fixa no topo; cada item com foto, descrição curta e preço exatamente como informado: [PREENCHER: cardápio com preços].
- Carrinho com quantidade, observação por item, taxa de entrega [PREENCHER: valor ou "a combinar"] e total.
- Finalizar pedido monta a mensagem completa e abre o WhatsApp [PREENCHER: número].
- Horário de funcionamento: fora do horário, mostrar "fechado agora" e o próximo horário de abertura.

## Restrições
- Não invente itens nem preços. Item sem foto usa um fundo neutro com o nome.
- Nada de cadastro obrigatório para pedir.

## Critérios de aceite
- Pedido de 3 itens do celular até o WhatsApp em menos de 1 minuto.
- Carrinho sobrevive a recarregar a página.

## Verificação
- Teste o fluxo inteiro no navegador em 375 px e me mostre a mensagem que chega no WhatsApp.`,
  },
  {
    id: "painel-admin",
    titulo: "Painel administrativo com Supabase",
    quando: "Cliente fechou e precisa editar produtos, preços ou agenda sozinho.",
    texto: `Adicione um painel administrativo ao projeto atual para o cliente [PREENCHER: nome] editar [PREENCHER: produtos / serviços / agenda / galeria] sem precisar de mim.

## Antes de começar
- Leia o projeto e siga a estrutura, os componentes e o estilo que já existem.
- Use Supabase (plano gratuito): banco, autenticação por e-mail e senha e storage para imagens. Me diga quais variáveis de ambiente criar — não coloque chaves no código.

## Requisitos
- Rota /admin protegida; só o e-mail [PREENCHER: e-mail do cliente] entra.
- Listar, criar, editar, reordenar e esconder itens; upload de foto com compressão no navegador.
- O site público lê do banco e atualiza sem novo deploy.
- Row Level Security: leitura pública só do que está visível; escrita só do admin.

## Critérios de aceite
- Um usuário sem login não consegue ler nem escrever nada do admin (teste com a chave anônima).
- Estados de carregando, vazio e erro em todas as telas.

## Entrega
- Passo a passo curto, com prints, para o cliente usar o painel.`,
  },
  {
    id: "auditoria-site",
    titulo: "Auditoria de um site existente",
    quando: "Para montar a abordagem de quem já tem site fraco.",
    texto: `Audite o site [PREENCHER: endereço] como se eu fosse oferecer um site novo para essa empresa.

## O que avaliar
- Celular: abre bem em 375 px? Botões tocáveis? Texto legível?
- Velocidade: peso das imagens, tempo até aparecer o conteúdo principal.
- Clareza: em 5 segundos dá para entender o que a empresa faz, onde fica e como chamar?
- Contato: tem WhatsApp, telefone clicável, mapa, horário?
- Confiança: HTTPS, informações desatualizadas, links quebrados, ano no rodapé.

## Regras
- Só aponte o que você verificou abrindo o site. Nada de suposição.
- Para cada problema: o que é, por que custa clientes e como um site novo resolve — em linguagem de dono de negócio, sem jargão.

## Entrega
- Os 3 problemas mais graves, em ordem.
- Uma mensagem de WhatsApp de até 6 linhas citando um deles, para eu mandar ao dono.`,
  },
  {
    id: "ajuste-responsivo",
    titulo: "Revisão final de responsividade",
    quando: "Antes de entregar qualquer projeto.",
    texto: `Faça a revisão final de responsividade e acabamento deste projeto antes da entrega ao cliente.

## Como fazer
- Abra cada página no navegador em 375, 768, 1024 e 1440 px.
- Procure: rolagem horizontal, texto cortado ou sobreposto, imagens distorcidas, botões menores que 44 px, espaçamentos irregulares, foco do teclado invisível, contraste baixo.
- Teste o fluxo principal (contato, pedido ou agendamento) de ponta a ponta no celular.

## Regras
- Corrija na origem (componente ou estilo), não com overflow escondido no corpo da página.
- Não mude a identidade visual aprovada; só corrija o que está quebrado.

## Entrega
- Lista do que encontrou e do que corrigiu, com print de antes e depois dos casos mais visíveis.`,
  },
  {
    id: "agendamento",
    titulo: "Sistema de agendamento online",
    quando: "Barbearia, salão, estética, clínica ou personal.",
    texto: `Crie um sistema de agendamento para [PREENCHER: nome], [PREENCHER: segmento] em [PREENCHER: cidade].

## Requisitos
- Cliente escolhe serviço, profissional (opcional) e horário livre; confirma com nome e WhatsApp, sem criar conta.
- Serviços, durações e preços exatamente como informados: [PREENCHER: lista].
- Horários de funcionamento e intervalos: [PREENCHER]. Nada de horário passado nem sobreposto.
- Painel do dono (login): agenda do dia e da semana, bloquear horários, marcar como atendido ou faltou.
- Confirmação abre o WhatsApp do estabelecimento com a mensagem do agendamento.

## Técnica
- Next.js + Tailwind + Supabase (plano gratuito), com Row Level Security.
- Fuso horário America/Manaus em todas as datas.

## Critérios de aceite
- Dois clientes não conseguem pegar o mesmo horário (teste em duas abas).
- Agendar pelo celular em menos de 30 segundos.`,
  },
];
