-- Inserir todos os módulos para todas as empresas existentes
-- Lista dos módulos principais do sistema
WITH modulos AS (
  SELECT unnest(ARRAY[
    'Clientes',
    'Prospecção', 
    'Personas',
    'Gatilhos',
    'Agentes IA',
    'Relatórios',
    'Treinamentos',
    'Notificações',
    'Configurações',
    'Administração'
  ]) AS modulo_nome
),
empresas_existentes AS (
  SELECT id as empresa_id FROM empresas
)
INSERT INTO empresa_modulos (empresa_id, modulo_nome, data_inicio, data_fim, ativo)
SELECT 
  e.empresa_id,
  m.modulo_nome,
  '2025-09-01'::date as data_inicio,
  '2030-12-31'::date as data_fim,
  true as ativo
FROM empresas_existentes e
CROSS JOIN modulos m
ON CONFLICT DO NOTHING;