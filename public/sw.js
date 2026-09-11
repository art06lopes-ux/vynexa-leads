/*
 * Service worker do Vynexa Leads.
 *
 * Faz uma coisa só: receber push e mostrar a notificação. Não faz cache
 * de página de propósito — um painel de trabalho precisa mostrar o dado
 * atual, e cache de HTML é a forma mais fácil de mostrar venda velha.
 *
 * Fica em `public/` porque o service worker precisa ser servido da raiz
 * do domínio para ter escopo sobre o site inteiro.
 */

self.addEventListener("push", (evento) => {
  let dados = { titulo: "Vynexa Leads", corpo: "", url: "/" };

  try {
    if (evento.data) dados = { ...dados, ...evento.data.json() };
  } catch {
    // Push sem JSON válido: mostra o título genérico em vez de falhar
    // em silêncio e o operador nunca saber que algo chegou.
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/icones/icone-192.png",
      badge: "/icones/notificacao-96.png",
      // Vibração curta; o padrão longo de algumas ROMs é irritante.
      vibrate: [80, 40, 80],
      data: { url: dados.url },
      // Notificações de venda não devem se sobrescrever: duas vendas em
      // um minuto são duas notificações, não uma substituindo a outra.
      tag: `vynexa-${Date.now()}`,
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Reaproveita uma aba aberta em vez de abrir outra a cada toque.
      for (const janela of janelas) {
        if ("focus" in janela) {
          janela.navigate(url);
          return janela.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
