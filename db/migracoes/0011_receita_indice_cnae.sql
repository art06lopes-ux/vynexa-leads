-- Índice por CNAE + CNPJ para a caçada "todo o Brasil".
--
-- A consulta sem estado filtrava por `cnae IN (...) AND cnpj > ?` e não
-- tinha índice que servisse: cada página varria a tabela inteira (3,4
-- milhões de linhas), e uma única caçada nacional custou dezenas de
-- milhões de linhas lidas — foi isso que esgotou a cota mensal de
-- leituras do plano gratuito e derrubou o site. Com o índice, lê só o
-- que casa.
CREATE INDEX IF NOT EXISTS receita_estab_cnae_cnpj_idx ON receita_estabelecimentos (cnae, cnpj);
