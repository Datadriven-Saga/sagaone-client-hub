
-- =============================================================================
-- Índice parcial para último status por (contato, evento)
-- =============================================================================
DROP INDEX IF EXISTS public.idx_logs_movimentacao_status_latest_per_event;
CREATE INDEX IF NOT EXISTS idx_logs_movimentacao_status_latest_per_event
  ON public.logs_movimentacao_contatos (contato_id, prospeccao_id, data_movimentacao DESC)
  WHERE status_novo IS NOT NULL;

-- =============================================================================
-- get_kanban_columns: otimizado para calcular status uma vez por par
-- =============================================================================
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
  v_statuses text[] := ARRAY['Novo','Atribuído','Em Espera','Convidado','Confirmado','Check-in','Venda','Descartado','Opt Out','Desperdício'];
  v_resp_tokens text[];
  v_resp_emails text[];
  v_resp_inc_null boolean := false;
  v_resp_inc_pri boolean := false;
BEGIN
  -- Parse responsável filter
  IF p_responsavel IS NOT NULL AND p_responsavel <> '' THEN
    v_resp_tokens := string_to_array(p_responsavel, ',');
    v_resp_inc_null := ('__null__' = ANY(v_resp_tokens));
    v_resp_inc_pri := ('__pri_ia__' = ANY(v_resp_tokens));
    SELECT ARRAY(SELECT t FROM unnest(v_resp_tokens) AS t WHERE t NOT IN ('__null__','__pri_ia__')) INTO v_resp_emails;
  END IF;

  WITH pares AS (
    SELECT c.id,
           c.lead_id,
           c.nome,
           c.telefone,
           c.email,
           c.responsavel_email,
           c.observacoes,
           c.origem::text AS origem,
           c.created_at,
           c.updated_at,
           c.vendedor_nome,
           c.tentativas_chamada,
           c.agente_ia,
           ep.prospeccao_id,
           c.status::text AS status_global
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
      AND (
        p_prospeccao_ids IS NULL OR array_length(p_prospeccao_ids, 1) IS NULL OR ep.prospeccao_id = ANY(p_prospeccao_ids)
      )
  ),
  status_por_par AS (
    SELECT p.*,
           COALESCE(
             lm.status_novo,
             p.status_global,
             'Novo'
           ) AS status
    FROM pares p
    LEFT JOIN LATERAL (
      SELECT lm.status_novo
      FROM logs_movimentacao_contatos lm
      WHERE lm.contato_id = p.id
        AND lm.prospeccao_id = p.prospeccao_id
        AND lm.status_novo IS NOT NULL
        AND COALESCE(lm.observacoes,'') NOT ILIKE 'auto-trigger%'
        AND COALESCE(lm.observacoes,'') NOT ILIKE '%fallback de migracao%'
      ORDER BY lm.data_movimentacao DESC
      LIMIT 1
    ) lm ON true
  ),
  ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY status ORDER BY updated_at DESC, id) AS rn,
           COUNT(DISTINCT id) OVER (PARTITION BY status) AS cnt
    FROM status_por_par
  ),
  agg AS (
    SELECT status,
           MAX(cnt) AS total_count,
           COALESCE(
             jsonb_agg(
               row_to_json((SELECT s FROM (SELECT id, lead_id, nome, telefone, email, status, prospeccao_id, responsavel_email, observacoes, origem, created_at, updated_at, vendedor_nome, tentativas_chamada, agente_ia) s))::jsonb
               ORDER BY updated_at DESC, id
             ) FILTER (WHERE rn <= p_per_column),
             '[]'::jsonb
           ) AS items
    FROM ranked
    GROUP BY status
  )
  SELECT COALESCE(
    jsonb_object_agg(
      status,
      jsonb_build_object('count', total_count, 'items', items)
    ),
    '{}'::jsonb
  )
  INTO v_result
  FROM agg;

  -- Garantir todas as chaves de status existam, mesmo com 0
  FOR i IN 1..array_length(v_statuses, 1) LOOP
    IF NOT (v_result ? v_statuses[i]) THEN
      v_result := v_result || jsonb_build_object(v_statuses[i], jsonb_build_object('count', 0, 'items', '[]'::jsonb));
    END IF;
  END LOOP;

  RETURN v_result;
END;
$function$;

-- =============================================================================
-- get_kanban_columns_limited: otimizado status != 'Novo'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_kanban_columns_limited(
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
  v_result jsonb;
  v_user_tipo tipo_acesso;
  v_is_limited boolean := false;
  v_user_email text;
  v_user_nome text;
  v_novo_limit integer;
  v_status text;
  v_count bigint;
  v_items jsonb;
  v_has_filter boolean := (p_prospeccao_ids IS NOT NULL AND array_length(p_prospeccao_ids, 1) > 0);
  v_statuses text[] := ARRAY['Novo','Atribuído','Em Espera','Convidado','Confirmado','Check-in','Venda','Descartado','Opt Out','Desperdício'];
BEGIN
  SELECT tipo_acesso INTO v_user_tipo FROM public.profiles WHERE id = auth.uid();
  v_is_limited := v_user_tipo IN ('SDR'::tipo_acesso, 'Vendedor'::tipo_acesso);

  IF NOT v_is_limited THEN
    RETURN get_kanban_columns(p_empresa_id, p_per_column, p_prospeccao_ids, p_responsavel, p_search, p_date_start, p_date_end);
  END IF;

  SELECT get_current_user_email() INTO v_user_email;
  SELECT p.nome_completo INTO v_user_nome FROM public.profiles p WHERE p.id = auth.uid();

  v_novo_limit := LEAST(p_per_column, 30);
  v_result := '{}'::jsonb;

  FOREACH v_status IN ARRAY v_statuses
  LOOP
    IF v_status = 'Novo' THEN
      -- Mantido o comportamento original (seletivo, por equipe)
      IF v_has_filter THEN
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
        WHERE c.empresa_id = p_empresa_id
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
          AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
          AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id AND em.user_id = auth.uid()
          );

        SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
        FROM (
          SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email,
                 public.get_contato_status_por_evento(c.id, ep.prospeccao_id) as status,
                 ep.prospeccao_id,
                 c.responsavel_email, c.observacoes, c.origem::text as origem,
                 c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada
          FROM contatos c
          INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
          WHERE c.empresa_id = p_empresa_id
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
            AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
            AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id AND em.user_id = auth.uid()
            )
          ORDER BY c.id, c.updated_at DESC
          LIMIT v_novo_limit
        ) sub;
      ELSE
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id AND pr.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
          AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
          AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id AND em.user_id = auth.uid()
          );

        SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
        FROM (
          SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email,
                 public.get_contato_status_por_evento(c.id, ep.prospeccao_id) as status,
                 ep.prospeccao_id,
                 c.responsavel_email, c.observacoes, c.origem::text as origem,
                 c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada
          FROM contatos c
          INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
          INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id AND pr.empresa_id = p_empresa_id
          WHERE c.empresa_id = p_empresa_id
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
            AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
            AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id AND em.user_id = auth.uid()
            )
          ORDER BY c.id, c.updated_at DESC
          LIMIT v_novo_limit
        ) sub;
      END IF;
    ELSE
      -- Demais status: otimizado em CTE única por status
      IF v_has_filter THEN
        SELECT COALESCE(COUNT(DISTINCT id), 0), COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY updated_at DESC, id), '[]'::jsonb) INTO v_count, v_items
        FROM (
          SELECT DISTINCT ON (sp.id) sp.id, sp.lead_id, sp.nome, sp.telefone, sp.email,
                 sp.status, sp.prospeccao_id,
                 sp.responsavel_email, sp.observacoes, sp.origem,
                 sp.created_at, sp.updated_at, sp.vendedor_nome, sp.tentativas_chamada
          FROM (
            SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
                   c.responsavel_email, c.observacoes, c.origem::text as origem,
                   c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada,
                   ep.prospeccao_id,
                   COALESCE(
                     (SELECT lm.status_novo FROM logs_movimentacao_contatos lm
                      WHERE lm.contato_id = c.id AND lm.prospeccao_id = ep.prospeccao_id
                        AND lm.status_novo IS NOT NULL
                        AND COALESCE(lm.observacoes,'') NOT ILIKE 'auto-trigger%'
                        AND COALESCE(lm.observacoes,'') NOT ILIKE '%fallback de migracao%'
                      ORDER BY lm.data_movimentacao DESC LIMIT 1),
                     c.status::text,
                     'Novo'
                   ) AS status
            FROM contatos c
            INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
            WHERE c.empresa_id = p_empresa_id
              AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
              AND (p_date_start IS NULL OR c.created_at >= p_date_start)
              AND (p_date_end IS NULL OR c.created_at <= p_date_end)
              AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          ) sp
          WHERE sp.status = v_status
          ORDER BY sp.id, sp.updated_at DESC
          LIMIT p_per_column
        ) sub;
      ELSE
        SELECT COALESCE(COUNT(DISTINCT id), 0), COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY updated_at DESC, id), '[]'::jsonb) INTO v_count, v_items
        FROM (
          SELECT DISTINCT ON (sp.id) sp.id, sp.lead_id, sp.nome, sp.telefone, sp.email,
                 sp.status, sp.prospeccao_id,
                 sp.responsavel_email, sp.observacoes, sp.origem,
                 sp.created_at, sp.updated_at, sp.vendedor_nome, sp.tentativas_chamada
          FROM (
            SELECT c.id, c.lead_id, c.nome, c.telefone, c.email,
                   c.responsavel_email, c.observacoes, c.origem::text as origem,
                   c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada,
                   ep.prospeccao_id,
                   COALESCE(
                     (SELECT lm.status_novo FROM logs_movimentacao_contatos lm
                      WHERE lm.contato_id = c.id AND lm.prospeccao_id = ep.prospeccao_id
                        AND lm.status_novo IS NOT NULL
                        AND COALESCE(lm.observacoes,'') NOT ILIKE 'auto-trigger%'
                        AND COALESCE(lm.observacoes,'') NOT ILIKE '%fallback de migracao%'
                      ORDER BY lm.data_movimentacao DESC LIMIT 1),
                     c.status::text,
                     'Novo'
                   ) AS status
            FROM contatos c
            INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
            INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id AND pr.empresa_id = p_empresa_id
            WHERE c.empresa_id = p_empresa_id
              AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
              AND (p_date_start IS NULL OR c.created_at >= p_date_start)
              AND (p_date_end IS NULL OR c.created_at <= p_date_end)
              AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          ) sp
          WHERE sp.status = v_status
          ORDER BY sp.id, sp.updated_at DESC
          LIMIT p_per_column
        ) sub;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  RETURN v_result;
END;
$function$;

-- Grant on index/table already existent
-- No new table created, so no additional GRANT needed beyond existing schema.
