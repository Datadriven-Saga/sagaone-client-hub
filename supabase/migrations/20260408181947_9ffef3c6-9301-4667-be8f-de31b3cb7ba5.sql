
CREATE OR REPLACE FUNCTION public.get_contatos_paginated(
  p_empresa_id uuid,
  p_prospeccao_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_direction text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_contatos jsonb;
  v_tipo_acesso text;
  v_user_email text;
  v_is_limited boolean := false;
BEGIN
  -- Detect caller role
  SELECT pr.tipo_acesso INTO v_tipo_acesso
  FROM profiles pr WHERE pr.id = auth.uid();

  IF v_tipo_acesso IN ('Vendedor', 'SDR') THEN
    v_is_limited := true;
    SELECT au.email INTO v_user_email
    FROM auth.users au WHERE au.id = auth.uid();
  END IF;

  IF p_prospeccao_id IS NOT NULL THEN
    -- Count
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
    WHERE c.empresa_id = p_empresa_id
      AND (p_status IS NULL OR c.status::text = p_status)
      AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
      AND (p_search IS NULL OR 
           c.nome ILIKE '%' || p_search || '%' OR 
           c.telefone ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email);

    -- Fetch paginated
    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status, 
             c.responsavel_email, c.observacoes, c.origem::text as origem, 
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
      WHERE c.empresa_id = p_empresa_id
        AND (p_status IS NULL OR c.status::text = p_status)
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             c.email ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
      ORDER BY 
        CASE WHEN p_sort_direction = 'desc' THEN c.updated_at END DESC,
        CASE WHEN p_sort_direction = 'asc' THEN c.updated_at END ASC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  ELSE
    -- Count without specific event
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
    WHERE c.empresa_id = p_empresa_id
      AND (p_status IS NULL OR c.status::text = p_status)
      AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
      AND (p_search IS NULL OR 
           c.nome ILIKE '%' || p_search || '%' OR 
           c.telefone ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email);

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
             c.responsavel_email, c.observacoes, c.origem::text as origem,
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
      INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
      WHERE c.empresa_id = p_empresa_id
        AND (p_status IS NULL OR c.status::text = p_status)
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             c.email ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
      ORDER BY c.id, c.updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'contatos', v_contatos
  );
END;
$$;
