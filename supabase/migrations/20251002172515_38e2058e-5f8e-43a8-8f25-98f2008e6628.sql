-- Adicionar 2 novas variáveis inativas após "Nome do Cliente"
WITH agentes_com_nome AS (
  SELECT DISTINCT agente_id
  FROM agente_variaveis
  WHERE nome ILIKE '%nome%cliente%'
),
agente_info AS (
  SELECT 
    acn.agente_id,
    (SELECT MAX(av.ordem) FROM agente_variaveis av WHERE av.agente_id = acn.agente_id) as max_ordem,
    (SELECT av.empresa_id FROM agente_variaveis av WHERE av.agente_id = acn.agente_id LIMIT 1) as empresa_id
  FROM agentes_com_nome acn
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
    ('E-mail', 'E-mail principal do cliente', 1),
    ('CPF', 'CPF do cliente para facilitar processos dentro da negociação como simulação de financiamento personalizada, cotação de seguro, etc', 2)
) AS variavel(nome, descricao, ordem_relativa);