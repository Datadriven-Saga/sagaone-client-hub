
-- Server-side paginated quarentena query with stats
CREATE OR REPLACE FUNCTION public.get_quarentena_paginated(
  p_empresa_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_marcas text[] DEFAULT NULL,
  p_lojas uuid[] DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_sort_column text DEFAULT 'ultimo_impacto_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  -- Build filtered results into a temp table for reuse
  CREATE TEMP TABLE _q_filtered ON COMMIT DROP AS
  SELECT 
    cq.*,
    e.nome_empresa AS empresa_nome,
    CASE
      WHEN cq.desativado THEN 'desativado'
      WHEN cq.data_fim_evento IS NULL THEN 'ativo'
      WHEN now() < cq.data_fim_evento THEN 'ativo'
      WHEN now() > (cq.data_fim_evento + INTERVAL '30 days') THEN 'expirado'
      ELSE 'ativo'
    END AS computed_status
  FROM contato_quarentena cq
  LEFT JOIN empresas e ON e.id = cq.empresa_id
  WHERE
    (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
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

  -- Apply status filter
  IF p_status IS NOT NULL AND p_status != 'all' THEN
    DELETE FROM _q_filtered WHERE computed_status != p_status;
  END IF;

  -- Stats from filtered set
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE computed_status = 'ativo'),
    COUNT(*) FILTER (WHERE computed_status = 'expirado'),
    COUNT(*) FILTER (WHERE computed_status = 'desativado')
  INTO v_total, v_ativos, v_expirados, v_desativados
  FROM _q_filtered;

  -- Distinct marcas for filter options (from unfiltered but company-scoped)
  SELECT COALESCE(jsonb_agg(DISTINCT cq.marca ORDER BY cq.marca), '[]'::jsonb)
  INTO v_marcas
  FROM contato_quarentena cq
  WHERE cq.marca IS NOT NULL
    AND (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id);

  -- Distinct lojas for filter options
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sub.empresa_id, 'nome', sub.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM (
    SELECT DISTINCT cq.empresa_id, e.nome_empresa
    FROM contato_quarentena cq
    JOIN empresas e ON e.id = cq.empresa_id
    WHERE p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id
    ORDER BY e.nome_empresa
  ) sub;

  -- Paginated items with sort
  SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT 
      id, telefone_normalizado, marca, empresa_id, evento_nome,
      prospeccao_id, data_fim_evento, ultimo_impacto_at, canal,
      created_at, updated_at, desativado, desativado_por, desativado_em,
      empresa_nome, computed_status
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

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quarentena_empresa_marca ON contato_quarentena(empresa_id, marca);
CREATE INDEX IF NOT EXISTS idx_quarentena_ultimo_impacto ON contato_quarentena(ultimo_impacto_at DESC);
CREATE INDEX IF NOT EXISTS idx_quarentena_telefone ON contato_quarentena(telefone_normalizado);
