-- Ação 1: Renomear "Modelo" para "Veículo de Interesse"
UPDATE agente_variaveis
SET nome = 'Veículo de Interesse', updated_at = now()
WHERE nome = 'Modelo';

-- Ação 2: Renomear "Modelo e Ano do Veículo" para "Modelo e Ano do Veículo Usado"
UPDATE agente_variaveis
SET nome = 'Modelo e Ano do Veículo Usado', updated_at = now()
WHERE nome = 'Modelo e Ano do Veículo';

-- Ação 3: Adicionar "Valor de Entrada" no final para todos os agentes (inativa)
INSERT INTO agente_variaveis (agente_id, nome, descricao, ordem, ativo, empresa_id, created_at, updated_at)
SELECT DISTINCT 
  av.agente_id,
  'Valor de Entrada',
  'Valor que o cliente pretende dar de entrada na negociação',
  99,
  false,
  av.empresa_id,
  now(),
  now()
FROM agente_variaveis av
WHERE NOT EXISTS (
  SELECT 1 FROM agente_variaveis av2 
  WHERE av2.agente_id = av.agente_id 
  AND av2.nome = 'Valor de Entrada'
);

-- Primeiro, mover todas para ordem temporária alta para evitar conflitos
UPDATE agente_variaveis
SET ordem = ordem + 1000, updated_at = now();

-- Ação 4: Reorganizar todas as variáveis na ordem especificada com status correto
UPDATE agente_variaveis av
SET 
  ordem = CASE av.nome
    WHEN 'Nome do cliente' THEN 1
    WHEN 'E-mail' THEN 2
    WHEN 'CPF' THEN 3
    WHEN 'Veículo de Interesse' THEN 4
    WHEN 'Equipe' THEN 5
    WHEN 'Canal de atendimento' THEN 6
    WHEN 'Varejo ou Venda Direta' THEN 7
    WHEN 'Veiculo Usado da Troca' THEN 8
    WHEN 'Modelo e Ano do Veículo Usado' THEN 9
    WHEN 'KM' THEN 10
    WHEN 'Placa' THEN 11
    WHEN 'Precificação' THEN 12
    WHEN 'Financiamento' THEN 13
    WHEN 'Valor de Entrada' THEN 14
    ELSE 99
  END,
  ativo = CASE av.nome
    WHEN 'Nome do cliente' THEN true
    WHEN 'Equipe' THEN true
    WHEN 'Canal de atendimento' THEN true
    ELSE false
  END,
  updated_at = now();

-- Ação 5: Excluir todas as variáveis da Gaia e Bela
DELETE FROM agente_variaveis
WHERE agente_id IN (
  SELECT id FROM agentes_ia 
  WHERE nome IN ('Gaia', 'Bela')
);