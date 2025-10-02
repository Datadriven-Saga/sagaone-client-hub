-- Atualizar todas as cadências de acompanhamento existentes
UPDATE agente_cadencias
SET 
  quantidade_etapas = 7,
  delay_inicial_minutos = 1440,
  intervalo_etapas_minutos = 1440,
  dias_semana = '["segunda", "terca", "quarta", "quinta", "sexta", "sabado"]'::jsonb,
  updated_at = now()
WHERE tipo_cadencia = 'acompanhamento';

-- Para garantir que novas cadências de acompanhamento também tenham essa configuração padrão
-- Atualizar o default da coluna dias_semana (removendo domingo)
ALTER TABLE agente_cadencias 
ALTER COLUMN dias_semana SET DEFAULT '["segunda", "terca", "quarta", "quinta", "sexta", "sabado"]'::jsonb;

COMMENT ON COLUMN agente_cadencias.quantidade_etapas IS 'Quantidade de etapas da cadência. Padrão: 4 para rápida, 7 para acompanhamento';
COMMENT ON COLUMN agente_cadencias.delay_inicial_minutos IS 'Delay até primeira etapa. Padrão: 0 para rápida, 1440 (24h) para acompanhamento';
COMMENT ON COLUMN agente_cadencias.intervalo_etapas_minutos IS 'Intervalo entre etapas. Padrão: 60 para rápida, 1440 (24h) para acompanhamento';