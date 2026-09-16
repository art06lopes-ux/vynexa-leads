-- Funil de leads: quando cada lead mudou de etapa, e uma observação livre.
--
-- `status` já existia em `leads` desde a Etapa 1, mas nada na interface
-- o alterava — depois do WhatsApp o sistema não sabia o que aconteceu.
-- O carimbo é o que permite dizer "parado há 12 dias em contatado".

ALTER TABLE leads ADD COLUMN status_em TEXT;
ALTER TABLE leads ADD COLUMN observacao TEXT;

-- Quem já tinha etapa ganha o carimbo da última atualização, que é a
-- melhor aproximação disponível — nunca um chute de data futura.
UPDATE leads SET status_em = atualizado_em WHERE status_em IS NULL;
