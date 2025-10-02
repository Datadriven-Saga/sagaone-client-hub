-- Adiciona campo tipo_cadencia na tabela agente_cadencias
ALTER TABLE agente_cadencias 
ADD COLUMN tipo_cadencia text NOT NULL DEFAULT 'rapida' 
CHECK (tipo_cadencia IN ('rapida', 'acompanhamento'));

-- Remove a constraint única de agente_id e ordem para permitir múltiplas cadências por agente
-- Agora a unicidade será por agente_id + tipo_cadencia
ALTER TABLE agente_cadencias 
DROP CONSTRAINT IF EXISTS agente_cadencias_agente_id_key;

-- Adiciona constraint única para agente_id + tipo_cadencia
ALTER TABLE agente_cadencias 
ADD CONSTRAINT agente_cadencias_agente_id_tipo_key 
UNIQUE (agente_id, tipo_cadencia);

COMMENT ON COLUMN agente_cadencias.tipo_cadencia IS 'Tipo de cadência: rapida ou acompanhamento';