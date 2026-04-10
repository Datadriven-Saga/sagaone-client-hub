
CREATE OR REPLACE FUNCTION public.get_quarentena_paginated(
  p_empresa_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_marcas text[] DEFAULT NULL,
  p_lojas text[] DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_sort_column text DEFAULT 'ultimo_impacto_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_canal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_total integer;
  v_ativos integer;
  v_expirados integer;
  v_desativados integer;
  v_marcas text[];
  v_lojas jsonb;
BEGIN
  -- Create temp table with computed status using LEFT JOIN instead of per-row function call
  CREATE TEMP TABLE tmp_quarentena ON COMMIT DROP AS
  SELECT
    cq.*,
    e.nome as empresa_nome,
    CASE
      WHEN cq.desativado THEN 'desativado'
      WHEN cq.data_fim_evento IS NULL THEN 'ativo'
      WHEN now() < cq.data_fim_evento::timestamptz THEN 'ativo'
      WHEN now() > (cq.data_fim_evento::timestamptz + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval) THEN 'expirado'
      ELSE 'ativo'
    END as computed_status
  FROM contato_quarentena cq
  LEFT JOIN empresas e ON e.id = cq.empresa_id
  LEFT JOIN quarentena_config qc ON qc.empresa_id = cq.empresa_id AND qc.marca = cq.marca AND qc.canal = cq.canal
  WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR cq.canal = p_canal);

  -- Apply search filter
  IF p_search IS NOT NULL AND p_search <> '' THEN
    DELETE FROM tmp_quarentena
    WHERE telefone_normalizado NOT ILIKE '%' || p_search || '%'
      AND (marca IS NULL OR marca NOT ILIKE '%' || p_search || '%')
      AND (evento_nome IS NULL OR evento_nome NOT ILIKE '%' || p_search || '%')
      AND (empresa_nome IS NULL OR empresa_nome NOT ILIKE '%' || p_search || '%');
  END IF;

  -- Apply marca filter
  IF p_marcas IS NOT NULL AND array_length(p_marcas, 1) > 0 THEN
    DELETE FROM tmp_quarentena WHERE marca IS NULL OR marca <> ALL(p_marcas);
  END IF;

  -- Apply loja filter
  IF p_lojas IS NOT NULL AND array_length(p_lojas, 1) > 0 THEN
    DELETE FROM tmp_quarentena WHERE empresa_id IS NULL OR empresa_id::text <> ALL(p_lojas);
  END IF;

  -- Apply date range filter
  IF p_date_from IS NOT NULL THEN
    DELETE FROM tmp_quarentena WHERE ultimo_impacto_at < p_date_from::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    DELETE FROM tmp_quarentena WHERE ultimo_impacto_at > p_date_to::timestamptz;
  END IF;

  -- Get stats
  SELECT count(*) INTO v_total FROM tmp_quarentena;
  SELECT count(*) INTO v_ativos FROM tmp_quarentena WHERE computed_status = 'ativo';
  SELECT count(*) INTO v_expirados FROM tmp_quarentena WHERE computed_status = 'expirado';
  SELECT count(*) INTO v_desativados FROM tmp_quarentena WHERE computed_status = 'desativado';

  -- Apply status filter
  IF p_status IS NOT NULL AND p_status <> 'all' THEN
    DELETE FROM tmp_quarentena WHERE computed_status <> p_status;
    SELECT count(*) INTO v_total FROM tmp_quarentena;
  END IF;

  -- Get available marcas
  SELECT array_agg(DISTINCT marca ORDER BY marca) INTO v_marcas FROM tmp_quarentena WHERE marca IS NOT NULL;

  -- Get available lojas
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', empresa_id::text, 'nome', empresa_nome)), '[]'::jsonb)
  INTO v_lojas
  FROM tmp_quarentena WHERE empresa_id IS NOT NULL AND empresa_nome IS NOT NULL;

  -- Build result with sorted/paginated items
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(row_to_json(t.*)::jsonb ORDER BY
        CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'desc' THEN t.ultimo_impacto_at END DESC NULLS LAST,
        CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'asc' THEN t.ultimo_impacto_at END ASC NULLS LAST,
        CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'desc' THEN t.telefone_normalizado END DESC NULLS LAST,
        CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'asc' THEN t.telefone_normalizado END ASC NULLS LAST,
        CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'desc' THEN t.marca END DESC NULLS LAST,
        CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'asc' THEN t.marca END ASC NULLS LAST,
        CASE WHEN p_sort_column = 'created_at' AND p_sort_direction = 'desc' THEN t.created_at END DESC NULLS LAST,
        CASE WHEN p_sort_column = 'created_at' AND p_sort_direction = 'asc' THEN t.created_at END ASC NULLS LAST
      )
      FROM (SELECT * FROM tmp_quarentena LIMIT p_limit OFFSET p_offset) t
    ), '[]'::jsonb),
    'total', v_total,
    'ativos', v_ativos,
    'expirados', v_expirados,
    'desativados', v_desativados,
    'availableMarcas', COALESCE(to_jsonb(v_marcas), '[]'::jsonb),
    'availableLojas', COALESCE(v_lojas, '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
