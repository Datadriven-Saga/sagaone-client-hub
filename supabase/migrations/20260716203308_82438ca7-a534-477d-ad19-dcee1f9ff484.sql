
-- Fix: PL/pgSQL não persiste CTE entre statements. Repetir WITH pares no SELECT de itens.

CREATE OR REPLACE FUNCTION public.get_kanban_columns(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_ids uuid[] DEFAULT NULL::uuid[],
  p_responsavel text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      ), agg AS (
        SELECT
          (SELECT COUNT(DISTINCT id) FROM pares WHERE status = v_status) AS cnt,
          COALESCE((
            SELECT jsonb_agg(row_to_json(sub.*))
            FROM (
              SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
                     responsavel_email, observacoes, origem, created_at, updated_at,
                     vendedor_nome, tentativas_chamada, agente_ia
              FROM pares
              WHERE status = v_status
              ORDER BY id, updated_at DESC
              LIMIT p_per_column
            ) sub
          ), '[]'::jsonb) AS items
      )
      SELECT cnt, items INTO v_count, v_items FROM agg;
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
      ), agg AS (
        SELECT
          (SELECT COUNT(DISTINCT id) FROM pares WHERE status = v_status) AS cnt,
          COALESCE((
            SELECT jsonb_agg(row_to_json(sub.*))
            FROM (
              SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
                     responsavel_email, observacoes, origem, created_at, updated_at,
                     vendedor_nome, tentativas_chamada, agente_ia
              FROM pares
              WHERE status = v_status
              ORDER BY id, updated_at DESC
              LIMIT p_per_column
            ) sub
          ), '[]'::jsonb) AS items
      )
      SELECT cnt, items INTO v_count, v_items FROM agg;
    END IF;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  RETURN v_result;
END;
$function$;


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
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    ), agg AS (
      SELECT
        (SELECT COUNT(DISTINCT id) FROM pares WHERE (p_status IS NULL OR status = p_status)) AS tot,
        COALESCE((
          SELECT jsonb_agg(row_to_json(sub.*))
          FROM (
            SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
                   responsavel_email, observacoes, origem, created_at, updated_at,
                   vendedor_nome, data_disparo_ia, tentativas_chamada, agente_ia
            FROM pares
            WHERE (p_status IS NULL OR status = p_status)
            ORDER BY id, updated_at DESC
            LIMIT p_limit OFFSET p_offset
          ) sub
        ), '[]'::jsonb) AS items
    )
    SELECT tot, items INTO v_total, v_contatos FROM agg;
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
    ), agg AS (
      SELECT
        (SELECT COUNT(DISTINCT id) FROM pares WHERE (p_status IS NULL OR status = p_status)) AS tot,
        COALESCE((
          SELECT jsonb_agg(row_to_json(sub.*))
          FROM (
            SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
                   responsavel_email, observacoes, origem, created_at, updated_at,
                   vendedor_nome, data_disparo_ia, tentativas_chamada, agente_ia
            FROM pares
            WHERE (p_status IS NULL OR status = p_status)
            ORDER BY id, updated_at DESC
            LIMIT p_limit OFFSET p_offset
          ) sub
        ), '[]'::jsonb) AS items
    )
    SELECT tot, items INTO v_total, v_contatos FROM agg;
  END IF;

  RETURN jsonb_build_object('total', v_total, 'contatos', v_contatos);
END;
$function$;
