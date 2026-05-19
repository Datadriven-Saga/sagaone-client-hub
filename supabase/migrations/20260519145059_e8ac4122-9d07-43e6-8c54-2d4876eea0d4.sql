-- Parte 1: coluna agente_ia + índice
ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS agente_ia TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contatos_agente_ia
  ON public.contatos USING GIN (agente_ia);

-- Helper que adiciona agente sem duplicar e registra no histórico
CREATE OR REPLACE FUNCTION public.add_agente_ia(
  p_contato_id UUID,
  p_agente TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added BOOLEAN := false;
BEGIN
  UPDATE public.contatos
  SET agente_ia = array_append(agente_ia, p_agente),
      updated_at = now()
  WHERE id = p_contato_id
    AND NOT (p_agente = ANY(agente_ia));

  GET DIAGNOSTICS v_added = ROW_COUNT;
  v_added := v_added::int > 0;

  IF v_added THEN
    INSERT INTO public.contato_timeline (
      contato_id, tipo, descricao, usuario_nome, metadata
    ) VALUES (
      p_contato_id,
      'agente_ia_atribuido',
      CASE WHEN p_agente = 'pri' THEN 'Pri IA tocou o lead'
           ELSE 'Agente IA "' || p_agente || '" tocou o lead' END,
      CASE WHEN p_agente = 'pri' THEN 'Pri IA' ELSE p_agente END,
      jsonb_build_object('agente', p_agente)
    );
  END IF;

  RETURN v_added;
END;
$$;

-- Parte 5: get_kanban_columns reconhece token __pri_ia__
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

  FOREACH v_status IN ARRAY v_statuses
  LOOP
    IF v_has_filter THEN
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
      WHERE c.empresa_id = p_empresa_id
        AND c.status::text = v_status
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
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%');

      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
               c.responsavel_email, c.observacoes, c.origem::text as origem,
               c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada, c.agente_ia
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
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
        ORDER BY c.id, c.updated_at DESC
        LIMIT p_per_column
      ) sub;
    ELSE
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
      INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
      WHERE c.empresa_id = p_empresa_id
        AND c.status::text = v_status
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
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%');

      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
               c.responsavel_email, c.observacoes, c.origem::text as origem,
               c.created_at, c.updated_at, c.vendedor_nome, c.tentativas_chamada, c.agente_ia
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
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
        ORDER BY c.id, c.updated_at DESC
        LIMIT p_per_column
      ) sub;
    END IF;

    v_result := v_result || jsonb_build_object(v_status, jsonb_build_object('count', v_count, 'items', v_items));
  END LOOP;

  RETURN v_result;
END;
$function$;