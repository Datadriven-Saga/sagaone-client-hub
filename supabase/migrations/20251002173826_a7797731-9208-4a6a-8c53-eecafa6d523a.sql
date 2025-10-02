-- Ativar a variável "Veículo de Interesse" em todos os agentes
UPDATE agente_variaveis
SET ativo = true, updated_at = now()
WHERE nome = 'Veículo de Interesse';