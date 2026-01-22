-- Adicionar coluna 'ativo' à tabela prospeccoes para controlar status de eventos
-- Por padrão todos os eventos são ativos
ALTER TABLE public.prospeccoes 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Criar índice para filtrar eventos ativos rapidamente
CREATE INDEX IF NOT EXISTS idx_prospeccoes_ativo ON public.prospeccoes(ativo);

-- Comentário explicativo
COMMENT ON COLUMN public.prospeccoes.ativo IS 'Indica se o evento está ativo (true) ou desativado (false). Eventos de IA Ligação não podem ser excluídos, apenas desativados.';