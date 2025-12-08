-- Remover a constraint única que impede múltiplas anotações por contato/prospecção
ALTER TABLE public.eventos_prospeccao 
DROP CONSTRAINT IF EXISTS unique_contato_prospeccao_eventos;