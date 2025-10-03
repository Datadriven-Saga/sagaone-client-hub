-- Atualizar as variáveis "Nome do Cliente" e "Veículo de Interesse" para obrigatório
UPDATE public.agente_variaveis
SET obrigatorio = true
WHERE nome IN ('Nome do Cliente', 'Veículo de Interesse');