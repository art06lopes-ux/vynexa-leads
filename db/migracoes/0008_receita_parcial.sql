-- Importação da Receita em várias rodadas: o Turso gratuito grava ~15 mil
-- linhas por minuto e os 6,5 milhões não cabem nas 3 h de uma rodada do
-- Actions. Cada rodada grava o que der, marca 'parcial' e dispara a
-- próxima, que pula em segundos o que já tem hash igual.
--
-- SQLite não altera CHECK no lugar; a tabela não é referenciada por
-- ninguém, então recriar é simples.

CREATE TABLE receita_importacoes_nova (
  id            TEXT PRIMARY KEY,
  referencia    TEXT NOT NULL,
  uf            TEXT NOT NULL,
  linhas        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento','parcial','concluida','erro')),
  erro          TEXT,
  iniciado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  concluido_em  TEXT
);

INSERT INTO receita_importacoes_nova SELECT id, referencia, uf, linhas, status, erro, iniciado_em, concluido_em FROM receita_importacoes;
DROP TABLE receita_importacoes;
ALTER TABLE receita_importacoes_nova RENAME TO receita_importacoes;
