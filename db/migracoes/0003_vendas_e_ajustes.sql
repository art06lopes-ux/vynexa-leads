-- Módulo de vendas e ajustes.
--
-- O dinheiro nunca passa por esta aplicação. O checkout é hospedado pela
-- Stripe; aqui só guardamos o que aconteceu, avisado por webhook. Nenhum
-- dado de cartão entra neste banco, e não há campo para isso em lugar
-- nenhum — é o que mantém o projeto fora do escopo de PCI.

-- ---------------------------------------------------------------------
-- produtos — o que você vende
-- ---------------------------------------------------------------------

CREATE TABLE produtos (
  id             TEXT PRIMARY KEY,
  nome           TEXT NOT NULL,
  descricao      TEXT,
  -- Centavos, INTEGER. Nunca REAL: 0.1 + 0.2 em ponto flutuante não dá
  -- 0.3, e num campo de dinheiro isso vira diferença de caixa.
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
  moeda          TEXT NOT NULL DEFAULT 'BRL',
  ativo          INTEGER NOT NULL DEFAULT 1,
  criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX produtos_ativo_idx ON produtos (ativo, nome);

-- ---------------------------------------------------------------------
-- vendas
-- ---------------------------------------------------------------------

CREATE TABLE vendas (
  id               TEXT PRIMARY KEY,
  produto_id       TEXT REFERENCES produtos(id) ON DELETE SET NULL,
  -- A qual lead a venda pertence, quando o checkout nasceu de um.
  -- `set null`: apagar um lead não pode apagar o histórico financeiro.
  lead_id          TEXT REFERENCES leads(id) ON DELETE SET NULL,

  descricao        TEXT NOT NULL,
  valor_centavos   INTEGER NOT NULL CHECK (valor_centavos >= 0),
  moeda            TEXT NOT NULL DEFAULT 'BRL',

  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','pago','cancelado','reembolsado')),
  origem           TEXT NOT NULL DEFAULT 'stripe'
                     CHECK (origem IN ('stripe','manual')),

  -- UNIQUE é o que torna o webhook idempotente: a Stripe reenvia o mesmo
  -- evento quando não recebe 200, e sem esta restrição a mesma venda
  -- entraria duas vezes e o faturamento do dia sairia dobrado.
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,

  cliente_email    TEXT,
  cliente_nome     TEXT,

  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em          TEXT
);

CREATE INDEX vendas_status_idx ON vendas (status, pago_em DESC);
CREATE INDEX vendas_pago_idx   ON vendas (pago_em DESC);
CREATE INDEX vendas_lead_idx   ON vendas (lead_id);

-- ---------------------------------------------------------------------
-- configuracoes — ajustes editáveis pela interface
-- ---------------------------------------------------------------------
--
-- Chave e valor, e não uma coluna por ajuste: cada ajuste novo viraria
-- uma migração. Aqui vive o que pode mudar sem redeploy (nome da
-- empresa, texto padrão). Credencial continua em variável de ambiente —
-- guardar chave da Stripe no banco só aumentaria a superfície exposta.

CREATE TABLE configuracoes (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO configuracoes (chave, valor) VALUES
  ('empresa_nome', 'Vynexa Dev'),
  ('moeda_padrao', 'BRL');
