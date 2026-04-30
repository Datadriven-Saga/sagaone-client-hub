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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_ativos bigint;
  v_expirados bigint;
  v_desativados bigint;
  v_marcas jsonb;
  v_lojas jsonb;
  v_is_admin boolean;
  v_user_marcas text[];
  v_effective_marcas text[];
  v_search_digits text;
  v_search_text text;
BEGIN
  v_is_admin := public.check_user_is_admin(auth.uid());

  IF v_is_admin THEN
    v_effective_marcas := CASE WHEN p_marcas IS NOT NULL AND array_length(p_marcas, 1) > 0 THEN p_marcas ELSE NULL END;
  ELSE
    v_user_marcas := public.get_user_marcas(auth.uid());
    IF v_user_marcas IS NULL OR array_length(v_user_marcas, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'items', '[]'::jsonb,
        'total', 0, 'ativos', 0, 'expirados', 0, 'desativados', 0,
        'availableMarcas', '[]'::jsonb, 'availableLojas', '[]'::jsonb
      );
    END IF;
    IF p_marcas IS NOT NULL AND array_length(p_marcas, 1) > 0 THEN
      SELECT array_agg(m) INTO v_effective_marcas
      FROM unnest(p_marcas) m
      WHERE m = ANY(v_user_marcas);
      IF v_effective_marcas IS NULL OR array_length(v_effective_marcas, 1) IS NULL THEN
        RETURN jsonb_build_object(
          'items', '[]'::jsonb,
          'total', 0, 'ativos', 0, 'expirados', 0, 'desativados', 0,
          'availableMarcas', to_jsonb(v_user_marcas), 'availableLojas', '[]'::jsonb
        );
      END IF;
    ELSE
      v_effective_marcas := v_user_marcas;
    END IF;
  END IF;

  -- Normaliza search: dígitos puros (telefone) vs texto (marca/evento)
  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    v_search_digits := regexp_replace(p_search, '\D', '', 'g');
    IF length(v_search_digits) >= 3 AND p_search ~ '^[\d\s\(\)\-\+\.]+$' THEN
      v_search_text := NULL;
    ELSE
      v_search_digits := NULL;
      v_search_text := lower(trim(p_search));
    END IF;
  END IF;

  -- Stats (sem JOIN com quarentena_config)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE
      NOT cq.desativado AND (cq.expira_em IS NULL OR now() <= cq.expira_em)
    ),
    COUNT(*) FILTER (WHERE
      NOT cq.desativado AND cq.expira_em IS NOT NULL AND now() > cq.expira_em
    ),
    COUNT(*) FILTER (WHERE cq.desativado)
  INTO v_total, v_ativos, v_expirados, v_desativados
  FROM contato_quarentena cq
  WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
    AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
    AND (p_canal IS NULL OR cq.canal = p_canal)
    AND (
      (v_search_digits IS NULL AND v_search_text IS NULL)
      OR (v_search_digits IS NOT NULL AND cq.telefone_normalizado LIKE v_search_digits || '%')
      OR (v_search_text IS NOT NULL AND (lower(cq.evento_nome) LIKE v_search_text || '%' OR lower(cq.marca) LIKE v_search_text || '%'))
    )
    AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id::text = ANY(p_lojas))
    AND (p_date_from IS NULL OR cq.ultimo_impacto_at >= p_date_from::timestamptz)
    AND (p_date_to IS NULL OR cq.ultimo_impacto_at <= p_date_to::timestamptz);

  -- Items paginados
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
        WHEN cq.expira_em IS NOT NULL AND now() > cq.expira_em THEN 'expirado'
        ELSE 'ativo'
      END AS computed_status
    FROM contato_quarentena cq
    LEFT JOIN empresas e ON e.id = cq.empresa_id
    WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
      AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
      AND (p_canal IS NULL OR cq.canal = p_canal)
      AND (
        (v_search_digits IS NULL AND v_search_text IS NULL)
        OR (v_search_digits IS NOT NULL AND cq.telefone_normalizado LIKE v_search_digits || '%')
        OR (v_search_text IS NOT NULL AND (lower(cq.evento_nome) LIKE v_search_text || '%' OR lower(cq.marca) LIKE v_search_text || '%'))
      )
      AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id::text = ANY(p_lojas))
      AND (p_date_from IS NULL OR cq.ultimo_impacto_at >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR cq.ultimo_impacto_at <= p_date_to::timestamptz)
      AND (p_status = 'all' OR p_status IS NULL OR
        (p_status = 'desativado' AND cq.desativado) OR
        (p_status = 'ativo' AND NOT cq.desativado AND (cq.expira_em IS NULL OR now() <= cq.expira_em)) OR
        (p_status = 'expirado' AND NOT cq.desativado AND cq.expira_em IS NOT NULL AND now() > cq.expira_em)
      )
    ORDER BY
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'desc' THEN cq.ultimo_impacto_at END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'asc'  THEN cq.ultimo_impacto_at END ASC  NULLS LAST,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'desc' THEN cq.data_fim_evento END DESC NULLS LAST,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'asc'  THEN cq.data_fim_evento END ASC  NULLS LAST,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'desc' THEN cq.telefone_normalizado END DESC,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'asc'  THEN cq.telefone_normalizado END ASC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'desc' THEN cq.marca END DESC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'asc'  THEN cq.marca END ASC,
      cq.ultimo_impacto_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  -- Marcas disponíveis (escopadas)
  SELECT COALESCE(jsonb_agg(DISTINCT m ORDER BY m), '[]'::jsonb) INTO v_marcas
  FROM (
    SELECT DISTINCT cq.marca AS m
    FROM contato_quarentena cq
    WHERE cq.marca IS NOT NULL
      AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
  ) s;

  -- Lojas disponíveis (escopadas pelas marcas permitidas)
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', e.id, 'nome', e.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM (
    SELECT DISTINCT cq.empresa_id
    FROM contato_quarentena cq
    WHERE cq.empresa_id IS NOT NULL
      AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
  ) s
  JOIN empresas e ON e.id = s.empresa_id;

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
$function$;