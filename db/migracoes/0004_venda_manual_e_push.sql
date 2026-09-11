-- Venda manual como função principal, e notificações push.

-- Como o cliente pagou. A venda manual é o caso comum (Pix direto na
-- conta); o Stripe fica só para cartão. Sem esta coluna, o relatório não
-- distinguiria o que passou pela Stripe do que caiu direto no banco.
ALTER TABLE vendas ADD COLUMN meio_pagamento TEXT
  CHECK (meio_pagamento IN ('pix','transferencia','dinheiro','cartao_stripe','outro'));

-- Assinaturas de push do navegador.
--
-- Cada dispositivo que ativar notificações gera um endpoint próprio,
-- mantido pelo navegador (Google no Android, Apple no iPhone). As chaves
-- `p256dh` e `auth` são o que criptografa a mensagem para aquele
-- dispositivo — sem elas o serviço de push não entrega nada legível.
CREATE TABLE push_assinaturas (
  endpoint      TEXT PRIMARY KEY,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  -- Guardado só para o operador reconhecer o aparelho na lista.
  agente        TEXT,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  -- Preenchido quando o serviço de push responde que o endpoint sumiu
  -- (app desinstalado, permissão revogada). A linha fica para auditoria
  -- e é ignorada nos envios.
  invalidada_em TEXT
);
