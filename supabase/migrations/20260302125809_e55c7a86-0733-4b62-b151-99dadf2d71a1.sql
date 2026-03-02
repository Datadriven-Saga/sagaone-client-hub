
-- RPC: Returns real counts per status AND top N items per column, with full filter support
-- This avoids the problem of distributing a single paginated page across Kanban columns
CREATE OR REPLACE FUNCTION public.get_kanban_columns(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_id uuid DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_status text;
  v_count bigint;
  v_items jsonb;
  v_statuses text[] := ARRAY['Novo','Atribuído','Em Espera','Convidado','Confirmado','Check-in','Venda','Descartado','Opt Out','Desperdício'];
BEGIN
  FOREACH v_status IN ARRAY v_statuses
  LOOP
    -- Count for this status
    IF p_prospeccao_id IS NOT NULL THEN
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
      WHERE c.empresa_id = p_empresa_id
        AND c.status::text = v_status
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%');
      
      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
               c.responsavel_email, c.observacoes, c.origem::text as origem,
               c.created_at, c.updated_at, c.vendedor_nome
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
          AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
          AND (p_search IS NULL OR 
               c.nome ILIKE '%' || p_search || '%' OR 
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        ORDER BY c.updated_at DESC
        LIMIT p_per_column
      ) sub;
    ELSE
      -- No specific event: only event-linked contacts (matching Kanban behavior)
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
      INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
      WHERE c.empresa_id = p_empresa_id
        AND c.status::text = v_status
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%');
      
      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
      FROM (
        SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
               c.responsavel_email, c.observacoes, c.origem::text as origem,
               c.created_at, c.updated_at, c.vendedor_nome
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
          AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
          AND (p_search IS NULL OR 
               c.nome ILIKE '%' || p_search || '%' OR 
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        ORDER BY c.id, c.updated_at DESC
        LIMIT p_per_column
      ) sub;
    END IF;

    v_result := v_result || jsonb_build_object(
      v_status, jsonb_build_object(
        'count', v_count,
        'items', v_items
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;
