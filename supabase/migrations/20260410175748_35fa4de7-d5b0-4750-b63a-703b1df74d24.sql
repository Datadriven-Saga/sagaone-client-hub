
DROP FUNCTION IF EXISTS public.get_quarentena_paginated(uuid, text, text[], text[], text, text, text, text, text, integer, integer, text);

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
STABLE
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
  -- Stats: count by computed status using inline CASE (no temp table)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE
      NOT cq.desativado AND (
        cq.data_fim_evento IS NULL
        OR now() < cq.data_fim_evento
        OR now() <= (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval)
      )
    ),
    COUNT(*) FILTER (WHERE
      NOT cq.desativado
      AND cq.data_fim_evento IS NOT NULL
      AND now() >= cq.data_fim_evento
      AND now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval)
    ),
    COUNT(*) FILTER (WHERE cq.desativado)
  INTO v_total, v_ativos, v_expirados, v_desativados
  FROM contato_quarentena cq
  LEFT JOIN quarentena_config qc ON qc.empresa_id = cq.empresa_id AND qc.marca = cq.marca AND qc.canal = cq.canal
  WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR cq.canal = p_canal)
    AND (p_search IS NULL OR p_search = '' OR
      cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
      cq.evento_nome ILIKE '%' || p_search || '%' OR
      cq.marca ILIKE '%' || p_search || '%'
    )
    AND (p_marcas IS NULL OR array_length(p_marcas, 1) IS NULL OR cq.marca = ANY(p_marcas))
    AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id::text = ANY(p_lojas))
    AND (p_date_from IS NULL OR cq.ultimo_impacto_at >= p_date_from::timestamptz)
    AND (p_date_to IS NULL OR cq.ultimo_impacto_at <= p_date_to::timestamptz);

  -- Paginated items with status filter
  SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      cq.id, cq.telefone_normalizado, cq.marca, cq.empresa_id, cq.evento_nome,
      cq.prospeccao_id, cq.data_fim_evento, cq.ultimo_impacto_at, cq.canal,
      cq.created_at, cq.updated_at, cq.desativado, cq.desativado_por, cq.desativado_em,
      e.nome_empresa AS empresa_nome,
      CASE
        WHEN cq.desativado THEN 'desativado'
        WHEN cq.data_fim_evento IS NULL THEN 'ativo'
        WHEN now() < cq.data_fim_evento THEN 'ativo'
        WHEN now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval) THEN 'expirado'
        ELSE 'ativo'
      END AS computed_status
    FROM contato_quarentena cq
    LEFT JOIN empresas e ON e.id = cq.empresa_id
    LEFT JOIN quarentena_config qc ON qc.empresa_id = cq.empresa_id AND qc.marca = cq.marca AND qc.canal = cq.canal
    WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR cq.canal = p_canal)
      AND (p_search IS NULL OR p_search = '' OR
        cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
        cq.evento_nome ILIKE '%' || p_search || '%' OR
        cq.marca ILIKE '%' || p_search || '%'
      )
      AND (p_marcas IS NULL OR array_length(p_marcas, 1) IS NULL OR cq.marca = ANY(p_marcas))
      AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id::text = ANY(p_lojas))
      AND (p_date_from IS NULL OR cq.ultimo_impacto_at >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR cq.ultimo_impacto_at <= p_date_to::timestamptz)
      AND (p_status = 'all' OR p_status IS NULL OR
        (p_status = 'desativado' AND cq.desativado) OR
        (p_status = 'ativo' AND NOT cq.desativado AND (
          cq.data_fim_evento IS NULL
          OR now() < cq.data_fim_evento
          OR now() <= (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval)
        )) OR
        (p_status = 'expirado' AND NOT cq.desativado AND cq.data_fim_evento IS NOT NULL AND now() >= cq.data_fim_evento AND
          now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval)
        )
      )
    ORDER BY
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'desc' THEN cq.ultimo_impacto_at END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'asc' THEN cq.ultimo_impacto_at END ASC NULLS LAST,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'desc' THEN cq.telefone_normalizado END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'asc' THEN cq.telefone_normalizado END ASC NULLS LAST,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'desc' THEN cq.marca END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'asc' THEN cq.marca END ASC NULLS LAST,
      CASE WHEN p_sort_column = 'created_at' AND p_sort_direction = 'desc' THEN cq.created_at END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'created_at' AND p_sort_direction = 'asc' THEN cq.created_at END ASC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) sub;

  -- Available marcas (lightweight query)
  SELECT COALESCE(jsonb_agg(DISTINCT cq.marca ORDER BY cq.marca), '[]'::jsonb)
  INTO v_marcas
  FROM contato_quarentena cq
  WHERE cq.marca IS NOT NULL
    AND (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id);

  -- Available lojas (lightweight query)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sub.empresa_id, 'nome', sub.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM (
    SELECT DISTINCT cq.empresa_id, e.nome_empresa
    FROM contato_quarentena cq
    JOIN empresas e ON e.id = cq.empresa_id
    WHERE p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id
    ORDER BY e.nome_empresa
    LIMIT 200
  ) sub;

  -- Update total when status filter is applied
  IF p_status IS NOT NULL AND p_status <> 'all' THEN
    CASE p_status
      WHEN 'ativo' THEN v_total := v_ativos;
      WHEN 'expirado' THEN v_total := v_expirados;
      WHEN 'desativado' THEN v_total := v_desativados;
      ELSE NULL;
    END CASE;
  END IF;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total,
    'ativos', v_ativos,
    'expirados', v_expirados,
    'desativados', v_desativados,
    'availableMarcas', COALESCE(v_marcas, '[]'::jsonb),
    'availableLojas', COALESCE(v_lojas, '[]'::jsonb)
  );
END;
$$;
