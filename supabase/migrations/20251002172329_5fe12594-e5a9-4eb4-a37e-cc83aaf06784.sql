-- Adicionar 3 novas variáveis inativas após a última variável de cada agente
WITH agentes_com_modelo AS (
  SELECT DISTINCT agente_id
  FROM agente_variaveis
  WHERE nome ILIKE '%modelo%ano%' OR nome ILIKE '%modelo e ano%'
),
agente_info AS (
  SELECT 
    acm.agente_id,
    (SELECT MAX(av.ordem) FROM agente_variaveis av WHERE av.agente_id = acm.agente_id) as max_ordem,
    (SELECT av.empresa_id FROM agente_variaveis av WHERE av.agente_id = acm.agente_id LIMIT 1) as empresa_id
  FROM agentes_com_modelo acm
)
INSERT INTO agente_variaveis (agente_id, nome, descricao, ordem, ativo, empresa_id, created_at, updated_at)
SELECT 
  ai.agente_id,
  variavel.nome,
  variavel.descricao,
  ai.max_ordem + variavel.ordem_relativa,
  false, -- todas criadas inativas
  ai.empresa_id,
  now(),
  now()
FROM agente_info ai
CROSS JOIN (
  VALUES 
    ('KM', 'Obter o numero de quilômetros rodados no veiculo usado que o cliente pretende utilizar como forma de pagamento.', 1),
    ('Placa', 'Obter a placa do veiculo nos padrões brasileiros, com 7 caracteres', 2),
    ('Precificação', 'Realizar a precificação do carro do cliente com base dos dados da placa e do KM do carro.', 3)
) AS variavel(nome, descricao, ordem_relativa);