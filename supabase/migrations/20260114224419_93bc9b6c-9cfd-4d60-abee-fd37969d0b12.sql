
-- Remover funções existentes se houver
DROP FUNCTION IF EXISTS public.get_prospeccao_metricas(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_prospeccao_status_options(UUID, UUID);

-- Função para obter métricas de uma prospecção de forma eficiente
CREATE OR REPLACE FUNCTION public.get_prospeccao_metricas(p_prospeccao_id UUID, p_empresa_id UUID)
RETURNS TABLE (
  total BIGINT,
  pendentes BIGINT,
  disparados BIGINT,
  vendas BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE c.data_disparo_ia IS NULL)::BIGINT as pendentes,
    COUNT(*) FILTER (WHERE c.data_disparo_ia IS NOT NULL)::BIGINT as disparados,
    COUNT(*) FILTER (WHERE c.status = 'Venda')::BIGINT as vendas
  FROM eventos_prospeccao ep
  JOIN contatos c ON c.id = ep.contato_id AND c.empresa_id = p_empresa_id
  WHERE ep.prospeccao_id = p_prospeccao_id;
$$;

-- Função para obter lista de status distintos de uma prospecção
CREATE OR REPLACE FUNCTION public.get_prospeccao_status_options(p_prospeccao_id UUID, p_empresa_id UUID)
RETURNS TABLE (status TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT c.status::TEXT as status
  FROM eventos_prospeccao ep
  JOIN contatos c ON c.id = ep.contato_id AND c.empresa_id = p_empresa_id
  WHERE ep.prospeccao_id = p_prospeccao_id
    AND c.status IS NOT NULL
  ORDER BY status;
$$;

-- Criar índices para melhorar performance das queries (IF NOT EXISTS para evitar erro)
CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_prospeccao_contato 
ON eventos_prospeccao(prospeccao_id, contato_id);

CREATE INDEX IF NOT EXISTS idx_contatos_empresa_disparo 
ON contatos(empresa_id, data_disparo_ia);

CREATE INDEX IF NOT EXISTS idx_contatos_empresa_status 
ON contatos(empresa_id, status);
