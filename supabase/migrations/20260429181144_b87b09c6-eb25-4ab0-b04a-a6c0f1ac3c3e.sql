-- Remove os índices parciais que causam o problema
DROP INDEX IF EXISTS pool_clientes_externos_empresa_proposta_uniq;
DROP INDEX IF EXISTS pool_clientes_externos_loja_proposta_uniq;

-- Limpa duplicatas caso existam (mantém o registro mais recente)
DELETE FROM pool_clientes_externos a
USING pool_clientes_externos b
WHERE a.codigo_proposta = b.codigo_proposta
  AND a.criado_em_origem < b.criado_em_origem;

-- Cria constraint única real sobre codigo_proposta
ALTER TABLE pool_clientes_externos
  ADD CONSTRAINT pool_clientes_externos_proposta_uq UNIQUE (codigo_proposta);