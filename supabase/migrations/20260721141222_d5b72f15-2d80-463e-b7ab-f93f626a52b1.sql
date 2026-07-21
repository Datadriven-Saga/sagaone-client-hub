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
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%');

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
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
          ORDER BY c.id, c.updated_at DESC
          LIMIT p_per_column
        ) sub;
      ELSE
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id AND pr.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
          AND (p_date_start IS NULL OR c.created_at >= p_date_start)
          AND (p_date_end IS NULL OR c.created_at <= p_date_end)
          AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%');

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
            AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = v_status
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email OR c.responsavel_email = v_user_nome OR c.vendedor_nome = v_user_nome)
            AND (p_date_start IS NULL OR c.created_at >= p_date_start)
            AND (p_date_end IS NULL OR c.created_at <= p_date_end)
            AND (p_search IS NULL OR c.nome ILIKE '%'||p_search||'%' OR c.telefone ILIKE '%'||p_search||'%' OR CAST(c.lead_id AS text) ILIKE '%'||p_search||'%')
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