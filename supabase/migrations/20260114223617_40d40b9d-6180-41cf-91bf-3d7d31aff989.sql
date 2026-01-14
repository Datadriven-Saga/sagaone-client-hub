-- Corrigir função para obter lista de status distintos
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

-- Criar índices para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_eventos_prospeccao_prospeccao_contato 
ON eventos_prospeccao(prospeccao_id, contato_id);

CREATE INDEX IF NOT EXISTS idx_contatos_empresa_disparo 
ON contatos(empresa_id, data_disparo_ia);

CREATE INDEX IF NOT EXISTS idx_contatos_empresa_status 
ON contatos(empresa_id, status);