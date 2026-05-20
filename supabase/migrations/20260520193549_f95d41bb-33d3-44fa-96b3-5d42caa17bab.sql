
CREATE OR REPLACE FUNCTION public.export_evento_base(
  p_prospeccao_id uuid,
  p_empresa_id uuid,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_disparo text DEFAULT 'todos',
  p_cursor uuid DEFAULT NULL,
  p_limit int DEFAULT 2000
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_like text;
BEGIN
  IF NOT public.user_can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('statement_timeout', '60000', true);

  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    v_search_like := '%' || lower(trim(p_search)) || '%';
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
    c.responsavel_email,
    c.vendedor_nome,
    c.created_at,
    c.updated_at,
    ep.data_disparo_ia
  FROM public.eventos_prospeccao ep
  JOIN public.contatos c ON c.id = ep.contato_id
  WHERE ep.prospeccao_id = p_prospeccao_id
    AND ep.contato_id IS NOT NULL
    AND c.empresa_id = p_empresa_id
    AND (p_cursor IS NULL OR ep.id > p_cursor)
    AND (p_status IS NULL OR p_status = 'todos' OR c.status::text = p_status)
    AND (
      p_disparo = 'todos'
      OR (p_disparo = 'pendente' AND ep.data_disparo_ia IS NULL)
      OR (p_disparo = 'disparado' AND ep.data_disparo_ia IS NOT NULL)
    )
    AND (
      v_search_like IS NULL
      OR lower(c.nome) LIKE v_search_like
      OR lower(coalesce(c.email,'')) LIKE v_search_like
      OR c.telefone LIKE v_search_like
    )
  ORDER BY ep.id ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_evento_base(uuid, uuid, text, text, text, uuid, int) TO authenticated;
