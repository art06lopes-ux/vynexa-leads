-- Etapa 4: base de CNPJs da Receita Federal como fonte de contato.
--
-- O OpenStreetMap dá nome e localização, mas em 9 de cada 10 empresas
-- não traz telefone nem e-mail. A Receita traz os dois, oficiais, para
-- todo estabelecimento ativo do país — em dados abertos, sem custo.

-- ---------------------------------------------------------------------
-- receita_estabelecimentos: o recorte importado (só estados escolhidos,
-- só estabelecimentos ativos). É uma cópia de trabalho, recriada a cada
-- importação; a tabela `empresas` continua sendo a carteira.
-- ---------------------------------------------------------------------

CREATE TABLE receita_estabelecimentos (
  cnpj              TEXT PRIMARY KEY,           -- 14 dígitos
  nome              TEXT NOT NULL,              -- fantasia; razão social quando não há
  razao_social      TEXT,
  cnae              TEXT NOT NULL,              -- principal, 7 dígitos
  cnaes_secundarios TEXT,                       -- separados por vírgula, como no arquivo
  uf                TEXT NOT NULL,
  municipio_codigo  TEXT NOT NULL,              -- código da própria Receita (não é IBGE)
  municipio         TEXT NOT NULL,              -- nome como no arquivo: caixa alta, sem acento
  logradouro        TEXT,
  numero            TEXT,
  complemento       TEXT,
  bairro            TEXT,
  cep               TEXT,
  telefone_1        TEXT,                       -- DDD + número, só dígitos
  telefone_2        TEXT,
  email             TEXT,
  inicio_atividade  TEXT,                       -- AAAA-MM-DD
  referencia        TEXT NOT NULL               -- pasta da Receita, ex.: 2026-09
);

CREATE INDEX receita_estab_local_idx ON receita_estabelecimentos (uf, municipio, cnae);
CREATE INDEX receita_estab_cnae_idx  ON receita_estabelecimentos (uf, cnae);

CREATE TABLE receita_importacoes (
  id            TEXT PRIMARY KEY,
  referencia    TEXT NOT NULL,
  uf            TEXT NOT NULL,
  linhas        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento','concluida','erro')),
  erro          TEXT,
  iniciado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  concluido_em  TEXT
);

-- ---------------------------------------------------------------------
-- empresas: ganha fonte, CNPJ, origem do telefone, e o CHECK de
-- email_origem passa a aceitar 'receita'.
--
-- SQLite não altera CHECK nem NOT NULL no lugar: recria e copia, como a
-- 0005 fez com `jobs`. Aqui há um cuidado a mais: `leads` referencia
-- `empresas` com ON DELETE CASCADE, e o Turso roda com foreign_keys
-- ligado — dropar a tabela com a checagem ativa apagaria todos os
-- leads. O PRAGMA desliga a checagem só durante este script; foi
-- verificado contra o Turso real antes de entrar aqui.
-- ---------------------------------------------------------------------

PRAGMA foreign_keys = OFF;

CREATE TABLE empresas_nova (
  id                TEXT PRIMARY KEY,
  busca_id          TEXT REFERENCES buscas(id) ON DELETE SET NULL,

  -- De onde a linha veio. Cada fonte tem sua chave natural, e o UNIQUE
  -- nela é o que garante o dedup entre buscas sobrepostas.
  fonte             TEXT NOT NULL DEFAULT 'osm' CHECK (fonte IN ('osm','receita')),
  osm_id            TEXT UNIQUE,                -- 'node/123' — nulo quando a fonte é a Receita
  cnpj              TEXT UNIQUE,                -- 14 dígitos — nulo quando a fonte é o OSM

  nome              TEXT NOT NULL,
  pais              TEXT NOT NULL,
  estado            TEXT,
  cidade            TEXT,
  endereco          TEXT,
  latitude          REAL,
  longitude         REAL,

  -- Todo campo abaixo é NULL quando a fonte não trouxe. Nunca preenchido
  -- por dedução: a regra do projeto é que dado ausente fica ausente.
  -- As colunas *_origem dizem de onde cada contato veio, para que a
  -- interface e a IA nunca precisem adivinhar.
  telefone          TEXT,
  telefone_origem   TEXT CHECK (telefone_origem IN ('osm','receita','manual')),
  telefone_manual   INTEGER NOT NULL DEFAULT 0,
  email             TEXT,
  email_origem      TEXT CHECK (email_origem IN ('osm','site','receita')),
  website           TEXT,
  instagram         TEXT,
  facebook          TEXT,

  categoria         TEXT NOT NULL,              -- slug do segmento
  cnae              TEXT,                       -- código da Receita, quando a fonte é ela
  fundada_em        TEXT,                       -- data de início de atividade na Receita

  avaliacao_nota    REAL,
  avaliacao_qtd     INTEGER,

  idioma_abordagem  TEXT NOT NULL DEFAULT 'pt-BR',

  status_site       TEXT NOT NULL DEFAULT 'sem_dado'
                      CHECK (status_site IN ('sem_site','rede_social','tem_site','sem_dado')),
  site_verificado_em TEXT,

  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO empresas_nova (
  id, busca_id, fonte, osm_id, cnpj, nome, pais, estado, cidade, endereco, latitude, longitude,
  telefone, telefone_origem, telefone_manual, email, email_origem, website, instagram, facebook,
  categoria, cnae, fundada_em, avaliacao_nota, avaliacao_qtd, idioma_abordagem, status_site,
  site_verificado_em, criado_em, atualizado_em
)
SELECT
  id, busca_id, 'osm', osm_id, NULL, nome, pais, estado, cidade, endereco, latitude, longitude,
  telefone,
  CASE WHEN telefone IS NULL THEN NULL WHEN telefone_manual = 1 THEN 'manual' ELSE 'osm' END,
  telefone_manual, email, email_origem, website, instagram, facebook,
  categoria, NULL, NULL, avaliacao_nota, avaliacao_qtd, idioma_abordagem, status_site,
  site_verificado_em, criado_em, atualizado_em
FROM empresas;

DROP TABLE empresas;
ALTER TABLE empresas_nova RENAME TO empresas;

CREATE INDEX empresas_busca_idx     ON empresas (busca_id);
CREATE INDEX empresas_categoria_idx ON empresas (categoria);
CREATE INDEX empresas_local_idx     ON empresas (pais, estado, cidade);
CREATE INDEX empresas_status_idx    ON empresas (status_site);
CREATE INDEX empresas_criado_idx    ON empresas (criado_em DESC);
CREATE INDEX empresas_fonte_idx     ON empresas (fonte);

PRAGMA foreign_keys = ON;

-- Quantas a Receita acrescentou em cada busca, separado do total do OSM.
ALTER TABLE buscas ADD COLUMN quantidade_receita INTEGER NOT NULL DEFAULT 0;
