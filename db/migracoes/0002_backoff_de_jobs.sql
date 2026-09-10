-- Espera entre retentativas de um job.
--
-- Motivo, medido na prática: numa primeira execução real do worker a
-- Overpass estava sobrecarregada, e as três tentativas foram gastas em
-- sequência dentro da mesma execução, em 220 segundos — quase todo o
-- orçamento de tempo, martelando um serviço público que já tinha dito
-- que estava ocupado.
--
-- Com esta coluna, a falha agenda a próxima tentativa para daqui a
-- alguns minutos e o worker parte para outro job. O cron de 5 minutos
-- passa a ser o relógio da retentativa, que é o comportamento que ele já
-- deveria ter desde o começo.

ALTER TABLE jobs ADD COLUMN disponivel_em TEXT;

DROP INDEX jobs_fila_idx;
CREATE INDEX jobs_fila_idx ON jobs (status, disponivel_em, criado_em);
