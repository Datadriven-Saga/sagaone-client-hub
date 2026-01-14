-- Adicionar campo para controlar quais contatos já foram disparados para IA
ALTER TABLE public.contatos 
ADD COLUMN IF NOT EXISTS data_disparo_ia TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índice para buscar contatos não disparados de forma eficiente
CREATE INDEX IF NOT EXISTS idx_contatos_disparo_ia 
ON public.contatos(empresa_id, data_disparo_ia) 
WHERE data_disparo_ia IS NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.contatos.data_disparo_ia IS 'Data/hora em que o contato foi enviado para a IA via webhook. NULL = ainda não disparado.';