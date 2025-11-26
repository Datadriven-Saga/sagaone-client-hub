-- Remove a constraint única que impede múltiplas anotações para o mesmo contato/prospecção
ALTER TABLE eventos_prospeccao DROP CONSTRAINT IF EXISTS unique_contato_prospeccao_eventos;