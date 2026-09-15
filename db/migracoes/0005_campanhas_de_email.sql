-- Etapa 3: campanhas de e-mail pelo Gmail, e enriquecimento de e-mail
-- a partir do site da própria empresa.

-- ---------------------------------------------------------------------
-- jobs: dois tipos novos.
--
-- SQLite não altera CHECK no lugar: recria a tabela e copia. É a única
-- forma, e é por isso que os tipos vêm todos listados de novo aqui.
-- ---------------------------------------------------------------------

CREATE TABLE jobs_nova (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'busca', 'analise_ia', 'enriquecer_email', 'gerar_emails', 'envio_email'
                )),
  payload       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluido','erro')),
  tentativas    INTEGER NOT NULL DEFAULT 0,
  lease_ate     TEXT,
  disponivel_em TEXT,
  erro          TEXT,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO jobs_nova (id, tipo, payload, status, tentativas, lease_ate, disponivel_em, erro, criado_em, atualizado_em)
SELECT id, tipo, payload, status, tentativas, lease_ate, disponivel_em, erro, criado_em, atualizado_em FROM jobs;

DROP TABLE jobs;
ALTER TABLE jobs_nova RENAME TO jobs;
CREATE INDEX jobs_fila_idx ON jobs (status, disponivel_em, criado_em);

-- ---------------------------------------------------------------------
-- Conta Google conectada.
--
-- Uma linha só: a ferramenta tem um operador. O refresh token vai
-- CIFRADO (AES-GCM com chave derivada do SEGREDO_SESSAO) — quem lê o
-- banco não consegue mandar e-mail em seu nome.
-- ---------------------------------------------------------------------

CREATE TABLE contas_google (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  email                 TEXT NOT NULL,
  refresh_token_cifrado TEXT NOT NULL,
  escopos               TEXT NOT NULL,
  conectado_em          TEXT NOT NULL DEFAULT (datetime('now')),
  -- Último erro de envio ou de renovação de token, para o painel avisar.
  ultimo_erro           TEXT
);

-- ---------------------------------------------------------------------
-- campanhas: contagem de envios por dia, para o limite do Gmail.
-- ---------------------------------------------------------------------

ALTER TABLE campanhas ADD COLUMN descricao TEXT;
ALTER TABLE campanhas ADD COLUMN total_leads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas ADD COLUMN enviados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas ADD COLUMN falhas INTEGER NOT NULL DEFAULT 0;

-- Rastreio de quando o e-mail foi gerado e o id da mensagem no Gmail.
ALTER TABLE envios ADD COLUMN gerado_em TEXT;
ALTER TABLE envios ADD COLUMN gmail_message_id TEXT;

-- Empresas: quando o site foi visitado em busca de e-mail. Evita
-- visitar o mesmo site a cada rodada.
ALTER TABLE empresas ADD COLUMN site_verificado_em TEXT;
