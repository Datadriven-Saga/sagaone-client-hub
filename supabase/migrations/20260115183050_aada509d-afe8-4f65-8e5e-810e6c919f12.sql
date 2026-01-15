-- Adicionar campo data_disparo_ia na tabela eventos_prospeccao para rastrear disparos por evento
ALTER TABLE public.eventos_prospeccao 
ADD COLUMN IF NOT EXISTS data_disparo_ia TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índice para performance nas consultas de disparo
CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_disparo 
ON public.eventos_prospeccao (prospeccao_id, data_disparo_ia);

-- Atualizar função de métricas para usar o novo campo
CREATE OR REPLACE FUNCTION public.get_prospeccao_metricas(
  p_prospeccao_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE (
  total BIGINT,
  pendentes BIGINT,
  disparados BIGINT,
  vendas BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(ep.id), 0)::BIGINT AS total,
    COALESCE(COUNT(CASE WHEN ep.data_disparo_ia IS NULL THEN 1 END), 0)::BIGINT AS pendentes,
    COALESCE(COUNT(CASE WHEN ep.data_disparo_ia IS NOT NULL THEN 1 END), 0)::BIGINT AS disparados,
    0::BIGINT AS vendas
  FROM eventos_prospeccao ep
  WHERE ep.prospeccao_id = p_prospeccao_id;
END;
$$;