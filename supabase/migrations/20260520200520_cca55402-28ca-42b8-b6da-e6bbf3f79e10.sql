CREATE OR REPLACE FUNCTION public.export_evento_base(
  p_empresa_id uuid,
  p_prospeccao_id uuid,
  p_cursor uuid DEFAULT NULL,
  p_limit int DEFAULT 2000,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'todos',
  p_disparo text DEFAULT 'todos'
)
RETURNS TABLE (
  evento_id uuid,
  contato_id uuid,
  nome text,
  telefone text,
  email text,
  status text,
  origem text,
  responsavel_email text,
  vendedor_nome text,
  created_at timestamptz,
  updated_at timestamptz,
  data_disparo_ia timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '60000', true);

  IF NOT public.user_can_access_empresa(p_empresa_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à empresa';
  END IF;

  RETURN QUERY
  SELECT
    ep.id AS evento_id,
    c.id AS contato_id,
    c.nome,
    c.telefone,
    c.email,
    c.status::text,
    c.origem,
    ep.responsavel_email,
    ep.vendedor_nome,
    ep.created_at,
    ep.updated_at,
    ep.data_disparo_ia
  FROM public.eventos_prospeccao ep
  JOIN public.contatos c ON c.id = ep.contato_id
  WHERE ep.prospeccao_id = p_prospeccao_id
    AND c.empresa_id = p_empresa_id
    AND (p_cursor IS NULL OR ep.id > p_cursor)
    AND (
      p_status IS NULL OR p_status = '' OR p_status = 'todos'
      OR c.status::text = p_status
    )
    AND (
      p_disparo = 'todos'
      OR (p_disparo = 'pendente' AND ep.data_disparo_ia IS NULL)
      OR (p_disparo = 'disparado' AND ep.data_disparo_ia IS NOT NULL)
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR c.nome ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
      OR c.telefone ILIKE '%' || p_search || '%'
    )
  ORDER BY ep.id ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_evento_base(uuid, uuid, uuid, integer, text, text, text) TO authenticated;