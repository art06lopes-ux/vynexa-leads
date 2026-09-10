-- Vynexa Leads — esquema inicial (Turso / libSQL)
--
-- SQLite não tem ENUM nem ARRAY. Os enums viram CHECK, as datas viram
-- TEXT no formato ISO-8601 de `datetime('now')` (ordenável como string,
-- que é o motivo de não usar epoch), e onde a especificação falava em
-- lista de ids existe uma tabela de junção.

-- ---------------------------------------------------------------------
-- buscas
-- ---------------------------------------------------------------------

CREATE TABLE buscas (
  id                    TEXT PRIMARY KEY,
  segmento              TEXT NOT NULL,
  pais                  TEXT NOT NULL,            -- ISO 3166-1 alpha-2
  estado                TEXT,                     -- nulo em países sem divisão
  cidade                TEXT,

  -- O rótulo e a bbox que o Nominatim devolveu. Guardados para reproduzir
  -- a busca e porque a expansão de raio parte deles.
  rotulo_resolvido      TEXT,
  bbox_sul REAL, bbox_oeste REAL, bbox_norte REAL, bbox_leste REAL,
  -- Até onde o worker precisou abrir a área para chegar perto de 50.
  raio_final_km         REAL,
  expansoes             INTEGER NOT NULL DEFAULT 0,

  status                TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','em_andamento','concluida','erro')),
  quantidade_encontrada INTEGER NOT NULL DEFAULT 0,
  quantidade_nova       INTEGER NOT NULL DEFAULT 0,
  erro                  TEXT,
  criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
  concluido_em          TEXT
);

CREATE INDEX buscas_status_idx ON buscas (status);
CREATE INDEX buscas_criado_idx ON buscas (criado_em DESC);

-- ---------------------------------------------------------------------
-- empresas
-- ---------------------------------------------------------------------

CREATE TABLE empresas (
  id                TEXT PRIMARY KEY,
  busca_id          TEXT REFERENCES buscas(id) ON DELETE SET NULL,

  -- Chave natural do OpenStreetMap, no formato 'node/123456'. O UNIQUE
  -- é o que garante o dedup entre buscas de áreas sobrepostas.
  osm_id            TEXT NOT NULL UNIQUE,

  nome              TEXT NOT NULL,
  pais              TEXT NOT NULL,
  estado            TEXT,
  cidade            TEXT,
  endereco          TEXT,
  latitude          REAL,
  longitude         REAL,

  -- Todo campo abaixo é NULL quando a fonte não trouxe. Nunca preenchido
  -- por dedução: a regra do projeto é que dado ausente fica ausente.
  telefone          TEXT,
  telefone_manual   INTEGER NOT NULL DEFAULT 0,
  email             TEXT,
  email_origem      TEXT CHECK (email_origem IN ('osm','site')),
  website           TEXT,
  instagram         TEXT,
  facebook          TEXT,

  categoria         TEXT NOT NULL,

  -- Sem fonte gratuita e legítima hoje: o OSM não guarda avaliação, e
  -- tanto raspar o Google Maps quanto usar a Places API estão fora do
  -- escopo. As colunas existem prontas; ficam NULL até haver fonte.
  avaliacao_nota    REAL,
  avaliacao_qtd     INTEGER,

  idioma_abordagem  TEXT NOT NULL DEFAULT 'pt-BR',

  status_site       TEXT NOT NULL DEFAULT 'sem_dado'
                      CHECK (status_site IN ('sem_site','rede_social','tem_site','sem_dado')),

  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX empresas_busca_idx     ON empresas (busca_id);
CREATE INDEX empresas_categoria_idx ON empresas (categoria);
CREATE INDEX empresas_local_idx     ON empresas (pais, estado, cidade);
CREATE INDEX empresas_status_idx    ON empresas (status_site);
CREATE INDEX empresas_criado_idx    ON empresas (criado_em DESC);

-- ---------------------------------------------------------------------
-- leads — o resultado da análise de IA (Etapa 2)
-- ---------------------------------------------------------------------

CREATE TABLE leads (
  id                 TEXT PRIMARY KEY,
  -- UNIQUE: uma empresa gera no máximo um lead. Reanálise atualiza a
  -- linha existente em vez de acumular versões.
  empresa_id         TEXT NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  score_oportunidade INTEGER CHECK (score_oportunidade BETWEEN 0 AND 100),
  motivo_problema    TEXT,
  mensagem_gerada    TEXT,
  canal_recomendado  TEXT CHECK (canal_recomendado IN ('whatsapp','email')),
  status             TEXT NOT NULL DEFAULT 'novo'
                       CHECK (status IN ('novo','contatado','respondeu','fechado','nao_interessado')),
  analisado_em       TEXT,
  criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX leads_score_idx  ON leads (score_oportunidade DESC);
CREATE INDEX leads_status_idx ON leads (status);

-- ---------------------------------------------------------------------
-- campanhas e envios (Etapa 3)
-- ---------------------------------------------------------------------

CREATE TABLE campanhas (
  id        TEXT PRIMARY KEY,
  nome      TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'rascunho'
              CHECK (status IN ('rascunho','em_envio','concluida','pausada')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Substitui o campo `leads_ids` da especificação: array não existe em SQL.
CREATE TABLE campanha_leads (
  campanha_id TEXT NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  lead_id     TEXT NOT NULL REFERENCES leads(id)     ON DELETE CASCADE,
  PRIMARY KEY (campanha_id, lead_id)
);

CREATE TABLE envios (
  id            TEXT PRIMARY KEY,
  campanha_id   TEXT NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  lead_id       TEXT NOT NULL REFERENCES leads(id)     ON DELETE CASCADE,
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp','email')),
  assunto       TEXT,
  corpo         TEXT,
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','na_fila','enviado','erro')),
  tentativas    INTEGER NOT NULL DEFAULT 0,
  erro          TEXT,
  enviado_em    TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  -- Se duas execuções do worker se sobrepuserem, esta restrição é o que
  -- impede o mesmo lead receber dois e-mails da mesma campanha.
  UNIQUE (campanha_id, lead_id)
);

CREATE INDEX envios_status_idx   ON envios (status);
CREATE INDEX envios_campanha_idx ON envios (campanha_id);

-- ---------------------------------------------------------------------
-- jobs — a fila que o GitHub Actions consome
-- ---------------------------------------------------------------------

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('busca','analise_ia','envio_email')),
  payload       TEXT NOT NULL,                -- JSON serializado
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluido','erro')),
  tentativas    INTEGER NOT NULL DEFAULT 0,

  -- Prazo do lease. Sem ele, um worker que morre no meio do processamento
  -- deixaria o job preso em 'em_andamento' para sempre; com ele, a próxima
  -- execução recupera o que passou do prazo.
  lease_ate     TEXT,

  erro          TEXT,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX jobs_fila_idx ON jobs (status, criado_em);
