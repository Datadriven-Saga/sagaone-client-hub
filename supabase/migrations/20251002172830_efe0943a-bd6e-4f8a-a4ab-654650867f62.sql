-- Criar tabela temporária com as variáveis únicas
CREATE TEMP TABLE temp_variaveis_unicas AS
SELECT DISTINCT ON (agente_id, nome)
  agente_id,
  nome,
  descricao,
  ativo,
  empresa_id
FROM agente_variaveis
ORDER BY agente_id, nome, created_at ASC;

-- Deletar todas as variáveis existentes
DELETE FROM agente_variaveis;

-- Reinserir com ordem correta
INSERT INTO agente_variaveis (agente_id, nome, descricao, ordem, ativo, empresa_id, created_at, updated_at)
SELECT 
  t.agente_id,
  t.nome,
  t.descricao,
  CASE t.nome
    WHEN 'Nome do cliente' THEN 1
    WHEN 'E-mail' THEN 2
    WHEN 'CPF' THEN 3
    WHEN 'Equipe' THEN 4
    WHEN 'Canal de atendimento' THEN 5
    WHEN 'Varejo ou Venda Direta' THEN 6
    WHEN 'Modelo e Ano do Veículo' THEN 7
    WHEN 'Modelo' THEN 8
    WHEN 'KM' THEN 9
    WHEN 'Placa' THEN 10
    WHEN 'Precificação' THEN 11
    WHEN 'Veiculo Usado da Troca' THEN 12
    WHEN 'Financiamento' THEN 13
    ELSE 99
  END as ordem,
  t.ativo,
  t.empresa_id,
  now(),
  now()
FROM temp_variaveis_unicas t
ORDER BY t.agente_id, 
  CASE t.nome
    WHEN 'Nome do cliente' THEN 1
    WHEN 'E-mail' THEN 2
    WHEN 'CPF' THEN 3
    WHEN 'Equipe' THEN 4
    WHEN 'Canal de atendimento' THEN 5
    WHEN 'Varejo ou Venda Direta' THEN 6
    WHEN 'Modelo e Ano do Veículo' THEN 7
    WHEN 'Modelo' THEN 8
    WHEN 'KM' THEN 9
    WHEN 'Placa' THEN 10
    WHEN 'Precificação' THEN 11
    WHEN 'Veiculo Usado da Troca' THEN 12
    WHEN 'Financiamento' THEN 13
    ELSE 99
  END;