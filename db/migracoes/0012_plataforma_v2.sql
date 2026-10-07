-- Plataforma v2: Google Places como fonte, CRM de oito etapas, campanhas
-- com fila de verdade, cobrança pelo Asaas, notificações e lista de
-- supressão.
--
-- POR QUE RECRIAR EM VEZ DE `ALTER TABLE`
-- Os CHECKs antigos (`fonte IN ('osm','receita')`, `status IN ('novo',
-- 'contatado',…)`, `origem IN ('stripe','manual')`) não deixam entrar os
-- valores novos, e SQLite não altera CHECK no lugar. A v2 recria essas
-- tabelas SEM CHECK nos enums que evoluem — quem valida é o código
-- (tipos em `src/db/tipos.ts`). Só ficam CHECKs de integridade que não
-- mudam com o produto (dinheiro >= 0, score entre 0 e 100).
--
-- POR QUE NESTA ORDEM
-- O D1 roda com foreign_keys ligado e não deixa desligar. `DROP TABLE`
-- num pai faz um `DELETE` implícito que DISPARA o ON DELETE CASCADE: dropar
-- `empresas` primeiro apagaria todos os leads. Por isso: (1) copia tudo
-- para tabelas `bak12_*`, (2) dropa dos filhos para o pai — quando o pai
-- cai, não tem mais filho para levar junto —, (3) recria do pai para os
-- filhos e (4) devolve os dados. As `bak12_*` ficam no banco até alguém
-- conferir a contagem; a 0013 as remove.

CREATE TABLE bak12_empresas       AS SELECT * FROM empresas;
CREATE TABLE bak12_leads          AS SELECT * FROM leads;
CREATE TABLE bak12_campanhas      AS SELECT * FROM campanhas;
CREATE TABLE bak12_campanha_leads AS SELECT * FROM campanha_leads;
CREATE TABLE bak12_envios         AS SELECT * FROM envios;
CREATE TABLE bak12_vendas         AS SELECT * FROM vendas;

DROP TABLE envios;
DROP TABLE campanha_leads;
DROP TABLE vendas;
DROP TABLE campanhas;
DROP TABLE leads;
DROP TABLE empresas;

-- ---------------------------------------------------------------------
-- produtos: catálogo editável. Ganha tipo (para a IA casar lead e
-- produto) e ordem de exibição.
-- ---------------------------------------------------------------------

ALTER TABLE produtos ADD COLUMN tipo TEXT;            -- site | sistema | app | saas | outro
ALTER TABLE produtos ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN entregaveis TEXT;     -- texto livre, uma linha por item

-- ---------------------------------------------------------------------
-- empresas
-- ---------------------------------------------------------------------

CREATE TABLE empresas (
  id                   TEXT PRIMARY KEY,
  busca_id             TEXT REFERENCES buscas(id) ON DELETE SET NULL,

  -- De onde a linha veio: google_places | osm | receita | csv | manual.
  -- `fonte_url` é o endereço público do registro na fonte (o link do
  -- Google Maps, o nó no OpenStreetMap) — o operador sempre consegue
  -- conferir o dado na origem.
  fonte                TEXT NOT NULL DEFAULT 'osm',
  fonte_url            TEXT,

  -- Chaves naturais de cada fonte. O UNIQUE de cada uma é a primeira
  -- linha do dedup; telefone, domínio e nome+endereço são as outras,
  -- conferidas no código (ver `src/services/duplicatas.ts`).
  place_id             TEXT UNIQUE,
  osm_id               TEXT UNIQUE,
  cnpj                 TEXT UNIQUE,

  nome                 TEXT NOT NULL,
  nome_chave           TEXT,               -- nome normalizado, para o dedup
  pais                 TEXT NOT NULL,
  estado               TEXT,
  cidade               TEXT,
  bairro               TEXT,
  cep                  TEXT,
  endereco             TEXT,
  endereco_chave       TEXT,               -- endereço normalizado, para o dedup
  latitude             REAL,
  longitude            REAL,

  -- Nulo quando a fonte não trouxe. Nunca preenchido por dedução.
  telefone             TEXT,
  telefone_e164        TEXT,               -- só dígitos, com DDI — chave do dedup
  telefone_origem      TEXT,
  telefone_manual      INTEGER NOT NULL DEFAULT 0,
  whatsapp             INTEGER,
  email                TEXT,
  email_origem         TEXT,
  website              TEXT,
  dominio              TEXT,               -- host do site próprio — chave do dedup
  instagram            TEXT,
  facebook             TEXT,

  categoria            TEXT NOT NULL,      -- slug ou termo pesquisado
  categoria_rotulo     TEXT,               -- como a fonte nomeia ("Barbearia", "Car detailing service")
  cnae                 TEXT,
  fundada_em           TEXT,

  -- O Google Places traz nota e quantidade de avaliações. O OSM e a
  -- Receita não — para essas fontes as colunas ficam nulas.
  avaliacao_nota       REAL,
  avaliacao_qtd        INTEGER,
  status_negocio       TEXT,               -- OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY

  idioma_abordagem     TEXT NOT NULL DEFAULT 'pt-BR',

  -- Presença declarada pela fonte (sem_site | rede_social | tem_site | sem_dado)
  -- e a qualidade medida visitando o site (excelente | bom | fraco | fora_do_ar).
  status_site          TEXT NOT NULL DEFAULT 'sem_dado',
  site_qualidade       TEXT,
  site_sinais          TEXT,               -- JSON com o que a visita mediu
  site_tempo_ms        INTEGER,
  site_avaliado_em     TEXT,
  site_verificado_em   TEXT,               -- visita em busca de e-mail (Etapa 3)

  -- Opt-out. Uma vez marcado, nenhuma campanha inclui a empresa.
  nao_contatar         INTEGER NOT NULL DEFAULT 0,
  nao_contatar_motivo  TEXT,
  nao_contatar_em      TEXT,

  criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO empresas (
  id, busca_id, fonte, fonte_url, place_id, osm_id, cnpj, nome, pais, estado, cidade, endereco,
  latitude, longitude, telefone, telefone_origem, telefone_manual, whatsapp, email, email_origem,
  website, instagram, facebook, categoria, cnae, fundada_em, avaliacao_nota, avaliacao_qtd,
  idioma_abordagem, status_site, site_verificado_em, criado_em, atualizado_em
)
SELECT
  id, busca_id, fonte,
  CASE WHEN osm_id IS NOT NULL THEN 'https://www.openstreetmap.org/' || osm_id END,
  NULL, osm_id, cnpj, nome, pais, estado, cidade, endereco,
  latitude, longitude, telefone, telefone_origem, telefone_manual, whatsapp, email, email_origem,
  website, instagram, facebook, categoria, cnae, fundada_em, avaliacao_nota, avaliacao_qtd,
  idioma_abordagem, status_site, site_verificado_em, criado_em, atualizado_em
FROM bak12_empresas;

CREATE INDEX empresas_busca_idx     ON empresas (busca_id);
CREATE INDEX empresas_categoria_idx ON empresas (categoria);
CREATE INDEX empresas_local_idx     ON empresas (pais, estado, cidade);
CREATE INDEX empresas_status_idx    ON empresas (status_site);
CREATE INDEX empresas_criado_idx    ON empresas (criado_em DESC);
CREATE INDEX empresas_fonte_idx     ON empresas (fonte);
CREATE INDEX empresas_whatsapp_idx  ON empresas (whatsapp);
CREATE INDEX empresas_telefone_idx  ON empresas (telefone_e164);
CREATE INDEX empresas_dominio_idx   ON empresas (dominio);
CREATE INDEX empresas_nome_idx      ON empresas (nome_chave, cidade);
CREATE INDEX empresas_geo_idx       ON empresas (latitude, longitude);

-- ---------------------------------------------------------------------
-- leads — um por empresa
-- ---------------------------------------------------------------------

CREATE TABLE leads (
  id                   TEXT PRIMARY KEY,
  empresa_id           TEXT NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,

  -- Score determinístico (regras em `src/services/score.ts`), com a
  -- lista de motivos que o compõem. `score_calculado_em` nulo indica um
  -- score antigo, dado pela IA antes da v2.
  score_oportunidade   INTEGER CHECK (score_oportunidade BETWEEN 0 AND 100),
  score_motivos        TEXT,
  score_calculado_em   TEXT,
  prioridade           TEXT,               -- alta | media | baixa

  -- Pipeline: novo, qualificado, abordado, respondeu, negociacao,
  -- proposta, fechado, perdido.
  etapa                TEXT NOT NULL DEFAULT 'novo',
  etapa_em             TEXT,
  motivo_perda         TEXT,

  motivo_problema      TEXT,
  mensagem_gerada      TEXT,
  canal_recomendado    TEXT,
  analise              TEXT,               -- JSON do LeadAnalyzer
  solucao_sugerida     TEXT,               -- site | agendamento | sistema | app | saas
  produto_sugerido_id  TEXT REFERENCES produtos(id) ON DELETE SET NULL,
  observacao           TEXT,

  contatado_em         TEXT,
  respondeu_em         TEXT,
  analisado_em         TEXT,
  criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO leads (
  id, empresa_id, score_oportunidade, etapa, etapa_em, motivo_problema, mensagem_gerada,
  canal_recomendado, observacao, contatado_em, analisado_em, criado_em, atualizado_em
)
SELECT
  id, empresa_id, score_oportunidade,
  CASE status
    WHEN 'contatado'       THEN 'abordado'
    WHEN 'nao_interessado' THEN 'perdido'
    ELSE status
  END,
  status_em, motivo_problema, mensagem_gerada, canal_recomendado, observacao,
  CASE WHEN status IN ('contatado','respondeu','fechado','nao_interessado') THEN status_em END,
  analisado_em, criado_em, atualizado_em
FROM bak12_leads;

CREATE INDEX leads_score_idx ON leads (score_oportunidade DESC);
CREATE INDEX leads_etapa_idx ON leads (etapa, etapa_em DESC);
CREATE INDEX leads_prioridade_idx ON leads (prioridade);

-- ---------------------------------------------------------------------
-- campanhas
-- ---------------------------------------------------------------------

CREATE TABLE campanhas (
  id               TEXT PRIMARY KEY,
  nome             TEXT NOT NULL,
  descricao        TEXT,
  -- rascunho | preparando | pronta | agendada | enviando | pausada | concluida | cancelada
  status           TEXT NOT NULL DEFAULT 'rascunho',
  canal            TEXT NOT NULL DEFAULT 'email',
  filtros          TEXT,                   -- JSON: como os leads foram escolhidos
  provedor_email   TEXT,                   -- gmail | resend | smtp — fixado na criação
  agendada_para    TEXT,
  ritmo_por_hora   INTEGER NOT NULL DEFAULT 20,
  limite_diario    INTEGER NOT NULL DEFAULT 80,
  -- Follow-up só existe se o operador ligou na criação. `followup_dias`
  -- é a lista de dias depois do primeiro envio, ex.: [3, 7].
  followup_ativo   INTEGER NOT NULL DEFAULT 0,
  followup_dias    TEXT,
  -- Quando o operador confirmou o envio, vendo o preview. Sem isto o
  -- worker não manda nada: é a trava contra disparo sem autorização.
  autorizada_em    TEXT,
  total_leads      INTEGER NOT NULL DEFAULT 0,
  enviados         INTEGER NOT NULL DEFAULT 0,
  falhas           INTEGER NOT NULL DEFAULT 0,
  abertos          INTEGER NOT NULL DEFAULT 0,
  cliques          INTEGER NOT NULL DEFAULT 0,
  respostas        INTEGER NOT NULL DEFAULT 0,
  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  concluida_em     TEXT
);

INSERT INTO campanhas (id, nome, descricao, status, provedor_email, autorizada_em, total_leads, enviados, falhas, criado_em, atualizado_em)
SELECT id, nome, descricao,
  CASE status WHEN 'em_envio' THEN 'enviando' ELSE status END,
  'gmail',
  -- As campanhas antigas já tinham sido disparadas pelo operador.
  CASE WHEN status <> 'rascunho' THEN criado_em END,
  total_leads, enviados, falhas, criado_em, criado_em
FROM bak12_campanhas;

CREATE INDEX campanhas_status_idx ON campanhas (status, criado_em DESC);

CREATE TABLE campanha_leads (
  campanha_id TEXT NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  lead_id     TEXT NOT NULL REFERENCES leads(id)     ON DELETE CASCADE,
  PRIMARY KEY (campanha_id, lead_id)
);

INSERT INTO campanha_leads SELECT campanha_id, lead_id FROM bak12_campanha_leads;

-- ---------------------------------------------------------------------
-- envios — a fila de mensagens
-- ---------------------------------------------------------------------

CREATE TABLE envios (
  id                   TEXT PRIMARY KEY,
  -- Nulo num envio avulso, feito do perfil do lead.
  campanha_id          TEXT REFERENCES campanhas(id) ON DELETE CASCADE,
  lead_id              TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  canal                TEXT NOT NULL DEFAULT 'email',
  passo                INTEGER NOT NULL DEFAULT 0,   -- 0 = primeira abordagem; 1, 2… = follow-ups
  destinatario         TEXT,
  assunto              TEXT,
  corpo                TEXT,
  -- pendente | preparado | agendado | enviando | enviado | entregue |
  -- aberto | clicado | respondeu | erro | cancelado
  status               TEXT NOT NULL DEFAULT 'pendente',
  provedor             TEXT,
  provedor_message_id  TEXT,
  -- Identificador opaco usado no pixel de abertura, no link rastreado e
  -- no descadastro. Aleatório: não revela o id do envio.
  token                TEXT UNIQUE,
  tentativas           INTEGER NOT NULL DEFAULT 0,
  erro                 TEXT,
  agendado_para        TEXT,
  gerado_em            TEXT,
  enviado_em           TEXT,
  entregue_em          TEXT,
  aberto_em            TEXT,
  clicado_em           TEXT,
  respondido_em        TEXT,
  criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campanha_id, lead_id, passo)
);

INSERT INTO envios (
  id, campanha_id, lead_id, canal, passo, assunto, corpo, status, provedor, provedor_message_id,
  tentativas, erro, gerado_em, enviado_em, criado_em, atualizado_em
)
SELECT
  id, campanha_id, lead_id, canal, 0, assunto, corpo,
  CASE status WHEN 'na_fila' THEN 'preparado' ELSE status END,
  CASE WHEN gmail_message_id IS NOT NULL THEN 'gmail' END,
  gmail_message_id, tentativas, erro, gerado_em, enviado_em, atualizado_em, atualizado_em
FROM bak12_envios;

CREATE INDEX envios_status_idx   ON envios (status, agendado_para);
CREATE INDEX envios_campanha_idx ON envios (campanha_id, status);
CREATE INDEX envios_lead_idx     ON envios (lead_id);
CREATE INDEX envios_enviado_idx  ON envios (enviado_em);

-- ---------------------------------------------------------------------
-- vendas
-- ---------------------------------------------------------------------

CREATE TABLE vendas (
  id                    TEXT PRIMARY KEY,
  produto_id            TEXT REFERENCES produtos(id)  ON DELETE SET NULL,
  lead_id               TEXT REFERENCES leads(id)     ON DELETE SET NULL,
  campanha_id           TEXT REFERENCES campanhas(id) ON DELETE SET NULL,

  descricao             TEXT NOT NULL,
  valor_centavos        INTEGER NOT NULL CHECK (valor_centavos >= 0),
  moeda                 TEXT NOT NULL DEFAULT 'BRL',

  status                TEXT NOT NULL DEFAULT 'pendente',   -- pendente | pago | vencido | cancelado | reembolsado
  origem                TEXT NOT NULL DEFAULT 'manual',     -- manual | stripe | asaas
  meio_pagamento        TEXT,                               -- pix | boleto | cartao | transferencia | dinheiro | cartao_stripe | outro

  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,

  cliente_nome          TEXT,
  cliente_empresa       TEXT,
  cliente_email         TEXT,
  cliente_telefone      TEXT,
  cliente_documento     TEXT,               -- CPF/CNPJ: o Asaas exige para emitir cobrança

  criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em               TEXT
);

INSERT INTO vendas (
  id, produto_id, lead_id, descricao, valor_centavos, moeda, status, origem, meio_pagamento,
  stripe_session_id, stripe_payment_intent, cliente_nome, cliente_email, criado_em, pago_em
)
SELECT
  id, produto_id, lead_id, descricao, valor_centavos, moeda, status, origem, meio_pagamento,
  stripe_session_id, stripe_payment_intent, cliente_nome, cliente_email, criado_em, pago_em
FROM bak12_vendas;

CREATE INDEX vendas_status_idx ON vendas (status, pago_em DESC);
CREATE INDEX vendas_pago_idx   ON vendas (pago_em DESC);
CREATE INDEX vendas_lead_idx   ON vendas (lead_id);

-- ---------------------------------------------------------------------
-- cobrancas — o que foi emitido no provedor de pagamento (Asaas)
-- ---------------------------------------------------------------------

CREATE TABLE cobrancas (
  id               TEXT PRIMARY KEY,
  venda_id         TEXT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  provedor         TEXT NOT NULL,                 -- asaas
  externo_id       TEXT NOT NULL,                 -- id da cobrança no provedor (pay_…)
  cliente_externo_id TEXT,                        -- id do cliente no provedor (cus_…)
  -- pendente | confirmado | recebido | vencido | cancelado | estornado
  status           TEXT NOT NULL DEFAULT 'pendente',
  forma            TEXT,                          -- PIX | BOLETO | CREDIT_CARD | UNDEFINED
  valor_centavos   INTEGER NOT NULL CHECK (valor_centavos >= 0),
  vencimento       TEXT,
  link_pagamento   TEXT,
  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provedor, externo_id)
);

CREATE INDEX cobrancas_venda_idx ON cobrancas (venda_id);

-- Cada evento de webhook entra uma vez. O provedor reenvia o mesmo evento
-- quando não recebe 200; o UNIQUE é o que impede contar a venda duas vezes.
CREATE TABLE webhook_eventos (
  id            TEXT PRIMARY KEY,
  provedor      TEXT NOT NULL,
  evento_id     TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  payload       TEXT NOT NULL,
  recebido_em   TEXT NOT NULL DEFAULT (datetime('now')),
  processado_em TEXT,
  erro          TEXT,
  UNIQUE (provedor, evento_id)
);

-- ---------------------------------------------------------------------
-- eventos — o histórico de cada lead
-- ---------------------------------------------------------------------

CREATE TABLE eventos (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,      -- ver TipoEvento em src/db/tipos.ts
  descricao  TEXT NOT NULL,
  dados      TEXT,               -- JSON opcional
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX eventos_lead_idx ON eventos (lead_id, criado_em DESC);
CREATE INDEX eventos_tipo_idx ON eventos (tipo, criado_em DESC);

-- O histórico começa com o que já se sabia de cada lead.
INSERT INTO eventos (id, lead_id, tipo, descricao, criado_em)
SELECT lower(hex(randomblob(16))), l.id, 'lead_encontrado', 'Lead encontrado', e.criado_em
FROM leads l JOIN empresas e ON e.id = l.empresa_id;

INSERT INTO eventos (id, lead_id, tipo, descricao, criado_em)
SELECT lower(hex(randomblob(16))), id, 'ia_analisou', 'IA analisou o lead', analisado_em
FROM leads WHERE analisado_em IS NOT NULL;

-- ---------------------------------------------------------------------
-- mensagens — versões de abordagem geradas pela IA, por lead
-- ---------------------------------------------------------------------

CREATE TABLE mensagens (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  -- curta | profissional | informal | whatsapp | instagram | email | followup
  tipo       TEXT NOT NULL,
  assunto    TEXT,
  corpo      TEXT NOT NULL,
  idioma     TEXT,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX mensagens_lead_idx ON mensagens (lead_id, criado_em DESC);

-- ---------------------------------------------------------------------
-- propostas
-- ---------------------------------------------------------------------

CREATE TABLE propostas (
  id             TEXT PRIMARY KEY,
  lead_id        TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  produto_id     TEXT REFERENCES produtos(id) ON DELETE SET NULL,
  titulo         TEXT NOT NULL,
  conteudo       TEXT NOT NULL,       -- JSON das seções
  valor_centavos INTEGER CHECK (valor_centavos IS NULL OR valor_centavos >= 0),
  status         TEXT NOT NULL DEFAULT 'rascunho',   -- rascunho | enviada | aceita | recusada
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX propostas_lead_idx ON propostas (lead_id, criado_em DESC);

-- ---------------------------------------------------------------------
-- notificacoes — a central do sino
-- ---------------------------------------------------------------------

CREATE TABLE notificacoes (
  id         TEXT PRIMARY KEY,
  -- venda | pagamento | resposta | email_enviado | erro_campanha |
  -- oportunidade | campanha_concluida | busca_concluida
  tipo       TEXT NOT NULL,
  titulo     TEXT NOT NULL,
  corpo      TEXT,
  link       TEXT,
  dados      TEXT,
  lida_em    TEXT,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX notificacoes_criado_idx ON notificacoes (criado_em DESC);
CREATE INDEX notificacoes_lida_idx   ON notificacoes (lida_em);

-- ---------------------------------------------------------------------
-- supressao — quem pediu para não ser contatado
-- ---------------------------------------------------------------------

CREATE TABLE supressao (
  tipo       TEXT NOT NULL,      -- email | telefone | dominio | place_id
  valor      TEXT NOT NULL,      -- normalizado (minúsculas; telefone em dígitos)
  motivo     TEXT,
  origem     TEXT,               -- descadastro | manual | resposta
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tipo, valor)
);

-- ---------------------------------------------------------------------
-- integracoes — chaves configuradas pela tela, CIFRADAS (AES-GCM).
-- A interface nunca recebe o valor de volta: só "configurada" e os
-- quatro últimos caracteres.
-- ---------------------------------------------------------------------

CREATE TABLE integracoes (
  chave          TEXT PRIMARY KEY,
  valor_cifrado  TEXT NOT NULL,
  final          TEXT,
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- limites — janela de rate limit (login, IA, busca)
-- ---------------------------------------------------------------------

CREATE TABLE limites (
  chave      TEXT NOT NULL,
  janela     TEXT NOT NULL,
  contagem   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela)
);

-- ---------------------------------------------------------------------
-- buscas: provedor, termo livre, raio e o resumo do resultado
-- ---------------------------------------------------------------------

ALTER TABLE buscas ADD COLUMN provedor TEXT NOT NULL DEFAULT 'osm';
ALTER TABLE buscas ADD COLUMN consulta_natural TEXT;
ALTER TABLE buscas ADD COLUMN bairro TEXT;
ALTER TABLE buscas ADD COLUMN cep TEXT;
ALTER TABLE buscas ADD COLUMN raio_km REAL;
ALTER TABLE buscas ADD COLUMN centro_lat REAL;
ALTER TABLE buscas ADD COLUMN centro_lng REAL;
ALTER TABLE buscas ADD COLUMN filtros TEXT;
ALTER TABLE buscas ADD COLUMN resumo TEXT;
ALTER TABLE buscas ADD COLUMN quantidade_duplicada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buscas ADD COLUMN requisicoes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buscas ADD COLUMN etapa_atual TEXT;

-- ---------------------------------------------------------------------
-- jobs: sem CHECK no tipo — cada tipo novo deixava de exigir migração.
-- ---------------------------------------------------------------------

CREATE TABLE jobs_nova (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL,
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

INSERT INTO jobs_nova SELECT id, tipo, payload, status, tentativas, lease_ate, disponivel_em, erro, criado_em, atualizado_em FROM jobs;
DROP TABLE jobs;
ALTER TABLE jobs_nova RENAME TO jobs;
CREATE INDEX jobs_fila_idx ON jobs (status, disponivel_em, criado_em);

-- ---------------------------------------------------------------------
-- busca_resultados — o que cada busca encontrou, inclusive empresas que
-- já estavam na carteira. O dedup mantém UM registro por empresa; esta
-- tabela é o que permite mostrar "47 encontradas" numa busca em que só
-- 30 eram novas.
-- ---------------------------------------------------------------------

CREATE TABLE busca_resultados (
  busca_id    TEXT NOT NULL REFERENCES buscas(id)   ON DELETE CASCADE,
  empresa_id  TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nova        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (busca_id, empresa_id)
);

CREATE INDEX busca_resultados_empresa_idx ON busca_resultados (empresa_id);

INSERT INTO busca_resultados (busca_id, empresa_id, nova)
SELECT busca_id, id, 1 FROM empresas WHERE busca_id IS NOT NULL;
