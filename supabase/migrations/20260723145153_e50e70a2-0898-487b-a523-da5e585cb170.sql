
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
  v_status text;
  v_count bigint;
  v_items jsonb;
BEGIN
  IF p_responsavel IS NOT NULL AND p_responsavel <> '' THEN
    v_resp_tokens := string_to_array(p_responsavel, ',');
    v_resp_inc_null := ('__null__' = ANY(v_resp_tokens));
    v_resp_inc_pri := ('__pri_ia__' = ANY(v_resp_tokens));
    SELECT ARRAY(SELECT t FROM unnest(v_resp_tokens) AS t WHERE t NOT IN ('__null__','__pri_ia__')) INTO v_resp_emails;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS __tmp_status_por_par ON COMMIT DROP AS
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
  )
  SELECT p.id,
         p.lead_id,
         p.nome,
         p.telefone,
         p.email,
         p.responsavel_email,
         p.observacoes,
         p.origem,
         p.created_at,
         p.updated_at,
         p.vendedor_nome,
         p.tentativas_chamada,
         p.agente_ia,
         p.prospeccao_id,
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
  ) lm ON true;

  FOREACH v_status IN ARRAY v_statuses
  LOOP
    SELECT COUNT(DISTINCT id) INTO v_count
    FROM __tmp_status_por_par
    WHERE status = v_status;

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*) ORDER BY updated_at DESC, id), '[]'::jsonb) INTO v_items
    FROM (
      SELECT DISTINCT ON (id) id, lead_id, nome, telefone, email, status,
             prospeccao_id, responsavel_email, observacoes, origem,
             created_at, updated_at, vendedor_nome, tentativas_chamada, agente_ia
      FROM __tmp_status_por_par
      WHERE status = v_status
      ORDER BY id, updated_at DESC
      LIMIT p_per_column
    ) sub;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  DROP TABLE IF EXISTS __tmp_status_por_par;

  RETURN v_result;
END;
$function$;

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
      IF v_has_filter THEN
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
        WHERE c.empresa_id = p_empresa_id
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status;

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
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
          ORDER BY c.id, c.updated_at DESC
          LIMIT p_per_column
        ) sub;
      ELSE
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id AND pr.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status;

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
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
          ORDER BY c.id, c.updated_at DESC
          LIMIT p_per_column
        ) sub;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  RETURN v_result;
END;
$function$;
