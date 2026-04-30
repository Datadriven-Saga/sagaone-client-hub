
-- 1) Helper: marcas que o usuário pode acessar
CREATE OR REPLACE FUNCTION public.get_user_marcas(p_user_id uuid DEFAULT auth.uid())
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT marca), '{}'::text[])
  FROM (
    SELECT e.marca
    FROM public.user_empresas ue
    JOIN public.empresas e ON e.id = ue.empresa_id
    WHERE ue.user_id = p_user_id AND e.marca IS NOT NULL
    UNION
    SELECT e.marca
    FROM public.profiles p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.id = p_user_id AND e.marca IS NOT NULL
    UNION
    SELECT e.marca
    FROM public.empresas e
    WHERE e.id = public.get_user_active_company(p_user_id) AND e.marca IS NOT NULL
  ) sub;
$$;

-- 2) RLS: SELECT por marca (admin vê tudo)
DROP POLICY IF EXISTS "Users can view quarantine" ON public.contato_quarentena;
CREATE POLICY "Users can view quarantine by brand"
ON public.contato_quarentena
FOR SELECT
TO authenticated
USING (
  public.check_user_is_admin(auth.uid())
  OR (marca IS NOT NULL AND marca = ANY(public.get_user_marcas(auth.uid())))
);

-- 3) RLS: UPDATE por marca (admin tudo)
DROP POLICY IF EXISTS "Users can update quarantine" ON public.contato_quarentena;
CREATE POLICY "Users can update quarantine by brand"
ON public.contato_quarentena
FOR UPDATE
TO authenticated
USING (
  public.check_user_is_admin(auth.uid())
  OR (marca IS NOT NULL AND marca = ANY(public.get_user_marcas(auth.uid())))
);

-- 4) get_quarentena_paginated: aplica escopo de marca para não-admin
CREATE OR REPLACE FUNCTION public.get_quarentena_paginated(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_marcas text[] DEFAULT NULL::text[],
  p_lojas text[] DEFAULT NULL::text[],
  p_status text DEFAULT 'all'::text,
  p_date_from text DEFAULT NULL::text,
  p_date_to text DEFAULT NULL::text,
  p_sort_column text DEFAULT 'ultimo_impacto_at'::text,
  p_sort_direction text DEFAULT 'desc'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_canal text DEFAULT NULL::text
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
BEGIN
  v_is_admin := public.check_user_is_admin(auth.uid());

  IF v_is_admin THEN
    -- admin: usa apenas filtro do usuário, se houver
    v_effective_marcas := CASE WHEN p_marcas IS NOT NULL AND array_length(p_marcas, 1) > 0 THEN p_marcas ELSE NULL END;
  ELSE
    v_user_marcas := public.get_user_marcas(auth.uid());
    IF v_user_marcas IS NULL OR array_length(v_user_marcas, 1) IS NULL THEN
      -- sem marcas associadas: retorna vazio
      RETURN jsonb_build_object(
        'items', '[]'::jsonb,
        'total', 0, 'ativos', 0, 'expirados', 0, 'desativados', 0,
        'availableMarcas', '[]'::jsonb, 'availableLojas', '[]'::jsonb
      );
    END IF;
    -- intersecta filtro do usuário com marcas permitidas
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

  -- Stats
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
    AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
    AND (p_canal IS NULL OR cq.canal = p_canal)
    AND (p_search IS NULL OR p_search = '' OR
      cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
      cq.evento_nome ILIKE '%' || p_search || '%' OR
      cq.marca ILIKE '%' || p_search || '%'
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
        WHEN now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval) THEN 'expirado'
        ELSE 'ativo'
      END AS computed_status
    FROM contato_quarentena cq
    LEFT JOIN empresas e ON e.id = cq.empresa_id
    LEFT JOIN quarentena_config qc ON qc.empresa_id = cq.empresa_id AND qc.marca = cq.marca AND qc.canal = cq.canal
    WHERE (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
      AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
      AND (p_canal IS NULL OR cq.canal = p_canal)
      AND (p_search IS NULL OR p_search = '' OR
        cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
        cq.evento_nome ILIKE '%' || p_search || '%' OR
        cq.marca ILIKE '%' || p_search || '%'
      )
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
          now() > (cq.data_fim_evento + (COALESCE(qc.dias, CASE WHEN cq.canal = 'whatsapp' THEN 20 ELSE 30 END) || ' days')::interval))
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
  SELECT COALESCE(jsonb_agg(DISTINCT m), '[]'::jsonb) INTO v_marcas
  FROM (
    SELECT cq.marca AS m
    FROM contato_quarentena cq
    WHERE cq.marca IS NOT NULL
      AND (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas))
  ) s;

  -- Lojas disponíveis (escopadas pelas marcas permitidas)
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', e.id, 'nome', e.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM contato_quarentena cq
  JOIN empresas e ON e.id = cq.empresa_id
  WHERE (v_effective_marcas IS NULL OR cq.marca = ANY(v_effective_marcas));

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

-- 5) upsert_quarentena: reativa registro desativado em novo impacto
CREATE OR REPLACE FUNCTION public.upsert_quarentena(
  p_telefone text, p_loja_id uuid, p_prospeccao_id uuid,
  p_evento_nome text, p_data_fim_evento timestamp with time zone,
  p_canal text DEFAULT 'whatsapp'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.quarentena_exclusoes WHERE telefone_normalizado = p_telefone) THEN
    RETURN;
  END IF;

  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;
  IF v_marca IS NULL THEN RETURN; END IF;

  INSERT INTO public.contato_quarentena (
    telefone_normalizado, empresa_id, marca, prospeccao_id,
    evento_nome, data_fim_evento, ultimo_impacto_at, canal
  ) VALUES (
    p_telefone, p_loja_id, v_marca, p_prospeccao_id,
    p_evento_nome, p_data_fim_evento, now(), p_canal
  )
  ON CONFLICT (telefone_normalizado, marca, canal) WHERE marca IS NOT NULL
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    prospeccao_id = EXCLUDED.prospeccao_id,
    evento_nome = EXCLUDED.evento_nome,
    data_fim_evento = EXCLUDED.data_fim_evento,
    ultimo_impacto_at = now(),
    desativado = false,
    desativado_por = NULL,
    desativado_em = NULL,
    updated_at = now();
END;
$function$;
