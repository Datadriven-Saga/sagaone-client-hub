
CREATE OR REPLACE FUNCTION public.get_kanban_columns_limited(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_id uuid DEFAULT NULL::uuid,
  p_responsavel text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text
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
  v_statuses text[] := ARRAY['Novo','Atribuído','Em Espera','Convidado','Confirmado','Check-in','Venda','Descartado','Opt Out','Desperdício'];
BEGIN
  -- Check if user is SDR or Vendedor
  SELECT tipo_acesso INTO v_user_tipo
  FROM public.profiles
  WHERE id = auth.uid();
  
  v_is_limited := v_user_tipo IN ('SDR'::tipo_acesso, 'Vendedor'::tipo_acesso);
  
  -- If not limited, delegate to the original function
  IF NOT v_is_limited THEN
    RETURN get_kanban_columns(p_empresa_id, p_per_column, p_prospeccao_id, p_responsavel, p_search);
  END IF;
  
  -- For limited users, get their identity
  SELECT get_current_user_email() INTO v_user_email;
  SELECT p.nome_completo INTO v_user_nome FROM public.profiles p WHERE p.id = auth.uid();
  
  v_novo_limit := LEAST(p_per_column, 30);
  v_result := '{}'::jsonb;
  
  FOREACH v_status IN ARRAY v_statuses
  LOOP
    IF v_status = 'Novo' THEN
      -- "Novo" column: show only leads WITHOUT a responsavel (available for assignment)
      IF p_prospeccao_id IS NOT NULL THEN
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = 'Novo'
          AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
          AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
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
            AND c.status::text = 'Novo'
            AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
            AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          ORDER BY c.updated_at DESC
          LIMIT v_novo_limit
        ) sub;
      ELSE
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = 'Novo'
          AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
          AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
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
            AND c.status::text = 'Novo'
            AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
            AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          ORDER BY c.id, c.updated_at DESC
          LIMIT v_novo_limit
        ) sub;
      END IF;
      
      -- Cap the displayed count at 30 for limited users
      v_count := LEAST(v_count, 30);
      
    ELSE
      -- All other columns: show only leads assigned to THIS vendedor/SDR
      IF p_prospeccao_id IS NOT NULL THEN
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = p_prospeccao_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
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
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
            AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          ORDER BY c.updated_at DESC
          LIMIT p_per_column
        ) sub;
      ELSE
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
        INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
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
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
            AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          ORDER BY c.id, c.updated_at DESC
          LIMIT p_per_column
        ) sub;
      END IF;
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
$function$;
