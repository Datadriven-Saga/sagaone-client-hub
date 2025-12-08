-- Remover índice único que pode estar impedindo múltiplas anotações
DROP INDEX IF EXISTS public.unique_contato_prospeccao_eventos;
DROP INDEX IF EXISTS public.idx_unique_contato_prospeccao_eventos;

-- Verificar e remover qualquer outra constraint que possa existir
ALTER TABLE public.eventos_prospeccao 
DROP CONSTRAINT IF EXISTS eventos_prospeccao_contato_prospeccao_key;

ALTER TABLE public.eventos_prospeccao 
DROP CONSTRAINT IF EXISTS eventos_prospeccao_contato_id_prospeccao_id_key;