-- Hash por linha da base da Receita: a importação mensal só reescreve o
-- que mudou, e é isso que a faz caber na cota de escrita do plano gratuito.
ALTER TABLE receita_estabelecimentos ADD COLUMN hash TEXT;
