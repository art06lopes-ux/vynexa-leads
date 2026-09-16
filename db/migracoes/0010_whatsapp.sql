-- "Abre WhatsApp?" como coluna, calculada na gravação.
--
-- A regra (número discável + celular, no Brasil) vive em
-- `normalizarTelefone`/`ehCelularBrasil` e não cabe em SQL. Sem a coluna,
-- o filtro "Canal = WhatsApp" dependia do canal que a IA recomendou — e
-- empresa ainda não analisada nunca aparecia nele. 1 = abre, 0 = não,
-- NULL = ainda não calculado (preenchido pelo script de migração).
ALTER TABLE empresas ADD COLUMN whatsapp INTEGER;
CREATE INDEX empresas_whatsapp_idx ON empresas (whatsapp);
