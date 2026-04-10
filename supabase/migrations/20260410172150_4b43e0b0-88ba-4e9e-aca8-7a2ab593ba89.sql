
CREATE OR REPLACE FUNCTION public.get_quarentena_paginated(
  p_empresa_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_marcas text[] DEFAULT NULL,
  p_lojas uuid[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_sort_column text DEFAULT 'ultimo_impacto_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_ativos bigint;
  v_expirados bigint;
  v_desativados bigint;
  v_marcas jsonb;
  v_lojas jsonb;
BEGIN
  -- Use a single LEFT JOIN instead of calling get_quarentena_dias() per row
  CREATE TEMP TABLE _q_filtered ON COMMIT DROP AS
  SELECT 
    cq.*,
    e.nome_empresa AS empresa_nome,
    COALESCE(qc.dias, CASE WHEN cq.canal = 'ligacao' THEN 30 ELSE 20 END) AS dias_config,
    CASE
      WHEN cq.desativado THEN 'desativado'
      WHEN cq.data_fim_evento IS NULL THEN 'ativo'
      WHEN now() < cq.data_fim_evento THEN 'ativo'
      WHEN now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'ligacao' THEN 30 ELSE 20 END) || ' days')::interval) THEN 'expirado'
      ELSE 'ativo'
    END AS computed_status
  FROM contato_quarentena cq
  LEFT JOIN empresas e ON e.id = cq.empresa_id
  LEFT JOIN quarentena_config qc ON qc.empresa_id = cq.empresa_id AND qc.marca = cq.marca AND qc.canal = cq.canal
  WHERE
    (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR cq.canal = p_canal)
    AND (p_search IS NULL OR p_search = '' OR
      cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
      cq.evento_nome ILIKE '%' || p_search || '%' OR
      cq.marca ILIKE '%' || p_search || '%' OR
      e.nome_empresa ILIKE '%' || p_search || '%'
    )
    AND (p_marcas IS NULL OR array_length(p_marcas, 1) IS NULL OR cq.marca = ANY(p_marcas))
    AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id = ANY(p_lojas))
    AND (p_date_from IS NULL OR COALESCE(cq.data_fim_evento, cq.ultimo_impacto_at) >= p_date_from)
    AND (p_date_to IS NULL OR COALESCE(cq.data_fim_evento, cq.ultimo_impacto_at) <= p_date_to);

  -- Filter by computed status if needed
  IF p_status IS NOT NULL AND p_status != 'all' THEN
    DELETE FROM _q_filtered WHERE computed_status != p_status;
  END IF;

  -- Stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE computed_status = 'ativo'),
    COUNT(*) FILTER (WHERE computed_status = 'expirado'),
    COUNT(*) FILTER (WHERE computed_status = 'desativado')
  INTO v_total, v_ativos, v_expirados, v_desativados
  FROM _q_filtered;

  -- Available marcas
  SELECT COALESCE(jsonb_agg(DISTINCT cq.marca ORDER BY cq.marca), '[]'::jsonb)
  INTO v_marcas
  FROM contato_quarentena cq
  WHERE cq.marca IS NOT NULL
    AND (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id);

  -- Available lojas
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sub.empresa_id, 'nome', sub.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM (
    SELECT DISTINCT cq.empresa_id, e.nome_empresa
    FROM contato_quarentena cq
    JOIN empresas e ON e.id = cq.empresa_id
    WHERE p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id
    ORDER BY e.nome_empresa
  ) sub;

  -- Paginated items
  SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT 
      id, telefone_normalizado, marca, empresa_id, evento_nome,
      prospeccao_id, data_fim_evento, ultimo_impacto_at, canal,
      created_at, updated_at, desativado, desativado_por, desativado_em,
      empresa_nome, computed_status, dias_config
    FROM _q_filtered
    ORDER BY
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'asc' THEN telefone_normalizado END ASC,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'desc' THEN telefone_normalizado END DESC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'asc' THEN COALESCE(marca, '') END ASC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'desc' THEN COALESCE(marca, '') END DESC,
      CASE WHEN p_sort_column = 'empresa_nome' AND p_sort_direction = 'asc' THEN COALESCE(empresa_nome, '') END ASC,
      CASE WHEN p_sort_column = 'empresa_nome' AND p_sort_direction = 'desc' THEN COALESCE(empresa_nome, '') END DESC,
      CASE WHEN p_sort_column = 'evento_nome' AND p_sort_direction = 'asc' THEN COALESCE(evento_nome, '') END ASC,
      CASE WHEN p_sort_column = 'evento_nome' AND p_sort_direction = 'desc' THEN COALESCE(evento_nome, '') END DESC,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'asc' THEN ultimo_impacto_at END ASC,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'desc' THEN ultimo_impacto_at END DESC,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'asc' THEN COALESCE(data_fim_evento, '1970-01-01'::timestamptz) END ASC,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'desc' THEN COALESCE(data_fim_evento, '1970-01-01'::timestamptz) END DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  DROP TABLE IF EXISTS _q_filtered;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'ativos', v_ativos,
    'expirados', v_expirados,
    'desativados', v_desativados,
    'availableMarcas', v_marcas,
    'availableLojas', v_lojas
  );
END;
$$;
