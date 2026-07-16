
CREATE INDEX IF NOT EXISTS idx_logs_movimentacao_contato_prosp_data
  ON public.logs_movimentacao_contatos (contato_id, prospeccao_id, data_movimentacao DESC);

CREATE OR REPLACE FUNCTION public.get_contato_status_por_evento(
  p_contato_id uuid,
  p_prospeccao_id uuid
) RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT lm.status_novo
       FROM public.logs_movimentacao_contatos lm
      WHERE lm.contato_id = p_contato_id
        AND lm.prospeccao_id = p_prospeccao_id
        AND lm.status_novo IS NOT NULL
      ORDER BY lm.data_movimentacao DESC
      LIMIT 1),
    'Novo'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_contato_status_por_evento(uuid, uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_prospeccao_status_options(
  p_prospeccao_id uuid,
  p_empresa_id uuid
) RETURNS TABLE(status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT s.status
  FROM (
    SELECT public.get_contato_status_por_evento(ep.contato_id, ep.prospeccao_id) AS status
    FROM public.eventos_prospeccao ep
    JOIN public.contatos c ON c.id = ep.contato_id AND c.empresa_id = p_empresa_id
    WHERE ep.prospeccao_id = p_prospeccao_id
  ) s
  WHERE s.status IS NOT NULL
  ORDER BY s.status;
$$;

CREATE OR REPLACE FUNCTION public.get_evento_base_contatos(
  p_empresa_id uuid,
  p_prospeccao_id uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_disparo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
BEGIN
  WITH base AS (
    SELECT c.id, c.lead_id, c.nome, c.telefone, c.email, c.origem::text AS origem,
           c.created_at, c.updated_at, c.responsavel_email, c.vendedor_nome, c.codigo_proposta,
           ep.data_disparo_ia,
           public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status
    FROM public.contatos c
    INNER JOIN public.eventos_prospeccao ep
      ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
    WHERE c.empresa_id = p_empresa_id
  ), filtered AS (
    SELECT * FROM base
    WHERE (p_search IS NULL OR p_search = '' OR
           nome ILIKE '%' || p_search || '%' OR
           telefone ILIKE '%' || p_search || '%' OR
           email ILIKE '%' || p_search || '%')
      AND (p_status IS NULL OR p_status = 'todos' OR status = p_status)
      AND (p_disparo IS NULL OR p_disparo = 'todos'
           OR (p_disparo = 'pendente' AND data_disparo_ia IS NULL)
           OR (p_disparo = 'disparado' AND data_disparo_ia IS NOT NULL))
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE((
      SELECT jsonb_agg(row_to_json(x.*))
      FROM (
        SELECT * FROM filtered
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) x
    ), '[]'::jsonb)
  INTO v_total, v_items;

  RETURN jsonb_build_object('total', v_total, 'contatos', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_evento_base_contatos(uuid, uuid, integer, integer, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_kanban_columns(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_ids uuid[] DEFAULT NULL::uuid[],
  p_responsavel text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_status text;
  v_count bigint;
  v_items jsonb;
  v_has_filter boolean := (p_prospeccao_ids IS NOT NULL AND array_length(p_prospeccao_ids, 1) > 0);
  v_statuses text[] := ARRAY['Novo','Atribuído','Em Espera','Convidado','Confirmado','Check-in','Venda','Descartado','Opt Out','Desperdício'];
  v_resp_tokens text[];
  v_resp_emails text[];
  v_resp_inc_null boolean := false;
  v_resp_inc_pri boolean := false;
BEGIN
  IF p_responsavel IS NOT NULL AND p_responsavel <> '' THEN
    v_resp_tokens := string_to_array(p_responsavel, ',');
    v_resp_inc_null := ('__null__' = ANY(v_resp_tokens));
    v_resp_inc_pri := ('__pri_ia__' = ANY(v_resp_tokens));
    SELECT ARRAY(SELECT t FROM unnest(v_resp_tokens) AS t WHERE t NOT IN ('__null__','__pri_ia__')) INTO v_resp_emails;
  END IF;

  FOREACH v_status IN ARRAY v_statuses LOOP
    IF v_has_filter THEN
      WITH pares AS (
        SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
               c.responsavel_email, c.observacoes, c.origem::text AS origem,
               c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada, c.agente_ia,
               ep.prospeccao_id,
               public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status
        FROM contatos c
        INNER JOIN eventos_prospeccao ep
          ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
        WHERE c.empresa_id = p_empresa_id
          AND (
            p_responsavel IS NULL
            OR (v_resp_inc_null AND c.responsavel_email IS NULL)
            OR (v_resp_inc_pri AND 'pri' = ANY(c.agente_ia))
            OR (v_resp_emails IS NOT NULL AND array_length(v_resp_emails,1) > 0 AND c.responsavel_email = ANY(v_resp_emails))
          )
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR
               c.nome ILIKE '%' || p_search || '%' OR
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      )
      SELECT COUNT(DISTINCT id) INTO v_count FROM pares WHERE status = v_status;

      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
               responsavel_email, observacoes, origem, created_at, updated_at,
               vendedor_nome, tentativas_chamada, agente_ia
        FROM pares
        WHERE status = v_status
        ORDER BY id, updated_at DESC
        LIMIT p_per_column
      ) sub;
    ELSE
      WITH pares AS (
        SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
               c.responsavel_email, c.observacoes, c.origem::text AS origem,
               c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada, c.agente_ia,
               ep.prospeccao_id,
               public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND (
            p_responsavel IS NULL
            OR (v_resp_inc_null AND c.responsavel_email IS NULL)
            OR (v_resp_inc_pri AND 'pri' = ANY(c.agente_ia))
            OR (v_resp_emails IS NOT NULL AND array_length(v_resp_emails,1) > 0 AND c.responsavel_email = ANY(v_resp_emails))
          )
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR
               c.nome ILIKE '%' || p_search || '%' OR
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      )
      SELECT COUNT(DISTINCT id) INTO v_count FROM pares WHERE status = v_status;

      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
               responsavel_email, observacoes, origem, created_at, updated_at,
               vendedor_nome, tentativas_chamada, agente_ia
        FROM pares
        WHERE status = v_status
        ORDER BY id, updated_at DESC
        LIMIT p_per_column
      ) sub;
    END IF;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contatos_paginated(
  p_empresa_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_prospeccao_ids uuid[] DEFAULT NULL::uuid[],
  p_status text DEFAULT NULL::text,
  p_responsavel text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_sort_column text DEFAULT 'updated_at'::text,
  p_sort_direction text DEFAULT 'desc'::text,
  p_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
  v_contatos jsonb;
  v_tipo_acesso text;
  v_user_email text;
  v_is_limited boolean := false;
  v_has_filter boolean := (p_prospeccao_ids IS NOT NULL AND array_length(p_prospeccao_ids, 1) > 0);
  v_resp_tokens text[];
  v_resp_emails text[];
  v_resp_inc_null boolean := false;
  v_resp_inc_pri boolean := false;
BEGIN
  IF p_responsavel IS NOT NULL AND p_responsavel <> '' THEN
    v_resp_tokens := string_to_array(p_responsavel, ',');
    v_resp_inc_null := ('__null__' = ANY(v_resp_tokens));
    v_resp_inc_pri := ('__pri_ia__' = ANY(v_resp_tokens));
    SELECT ARRAY(SELECT t FROM unnest(v_resp_tokens) AS t WHERE t NOT IN ('__null__','__pri_ia__')) INTO v_resp_emails;
  END IF;

  SELECT pr.tipo_acesso INTO v_tipo_acesso FROM profiles pr WHERE pr.id = auth.uid();
  IF v_tipo_acesso IN ('Vendedor', 'SDR') THEN
    v_is_limited := true;
    SELECT au.email INTO v_user_email FROM auth.users au WHERE au.id = auth.uid();
  END IF;

  IF v_has_filter THEN
    WITH pares AS (
      SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
             c.responsavel_email, c.observacoes, c.origem::text AS origem,
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia,
             c.tentativas_chamada, c.agente_ia,
             ep.prospeccao_id,
             public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status
      FROM contatos c
      INNER JOIN eventos_prospeccao ep
        ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
      WHERE c.empresa_id = p_empresa_id
        AND (
          p_responsavel IS NULL
          OR (v_resp_inc_null AND c.responsavel_email IS NULL)
          OR (v_resp_inc_pri AND 'pri' = ANY(c.agente_ia))
          OR (v_resp_emails IS NOT NULL AND array_length(v_resp_emails,1) > 0 AND c.responsavel_email = ANY(v_resp_emails))
        )
        AND (p_date_start IS NULL OR c.created_at >= p_date_start)
        AND (p_date_end IS NULL OR c.created_at <= p_date_end)
        AND (p_search IS NULL OR c.nome ILIKE '%' || p_search || '%' OR c.telefone ILIKE '%' || p_search || '%' OR c.email ILIKE '%' || p_search || '%' OR CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
    )
    SELECT COUNT(DISTINCT id) INTO v_total FROM pares WHERE (p_status IS NULL OR status = p_status);

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
             responsavel_email, observacoes, origem, created_at, updated_at,
             vendedor_nome, data_disparo_ia, tentativas_chamada, agente_ia
      FROM pares
      WHERE (p_status IS NULL OR status = p_status)
      ORDER BY id, updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  ELSE
    WITH pares AS (
      SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
             c.responsavel_email, c.observacoes, c.origem::text AS origem,
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia,
             c.tentativas_chamada, c.agente_ia,
             ep.prospeccao_id,
             public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
      INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
      WHERE c.empresa_id = p_empresa_id
        AND (
          p_responsavel IS NULL
          OR (v_resp_inc_null AND c.responsavel_email IS NULL)
          OR (v_resp_inc_pri AND 'pri' = ANY(c.agente_ia))
          OR (v_resp_emails IS NOT NULL AND array_length(v_resp_emails,1) > 0 AND c.responsavel_email = ANY(v_resp_emails))
        )
        AND (p_date_start IS NULL OR c.created_at >= p_date_start)
        AND (p_date_end IS NULL OR c.created_at <= p_date_end)
        AND (p_search IS NULL OR c.nome ILIKE '%' || p_search || '%' OR c.telefone ILIKE '%' || p_search || '%' OR c.email ILIKE '%' || p_search || '%' OR CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
    )
    SELECT COUNT(DISTINCT id) INTO v_total FROM pares WHERE (p_status IS NULL OR status = p_status);

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
             responsavel_email, observacoes, origem, created_at, updated_at,
             vendedor_nome, data_disparo_ia, tentativas_chamada, agente_ia
      FROM pares
      WHERE (p_status IS NULL OR status = p_status)
      ORDER BY id, updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  END IF;

  RETURN jsonb_build_object('total', v_total, 'contatos', v_contatos);
END;
$$;
