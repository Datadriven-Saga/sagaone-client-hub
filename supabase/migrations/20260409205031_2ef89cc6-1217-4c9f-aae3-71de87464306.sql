
-- Drop existing functions (need to drop dependent first)
DROP FUNCTION IF EXISTS public.get_kanban_columns_limited(uuid, integer, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_kanban_columns(uuid, integer, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_contatos_paginated(uuid, uuid, text, text, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.get_contatos_paginated(uuid, integer, integer, uuid, text, text, text, text, text);

-- =============================================
-- 1. get_kanban_columns (accepts uuid[])
-- =============================================
CREATE OR REPLACE FUNCTION public.get_kanban_columns(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_ids uuid[] DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL
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
BEGIN
  FOREACH v_status IN ARRAY v_statuses
  LOOP
    IF v_has_filter THEN
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
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
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
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
    ELSE
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
$function$;

-- =============================================
-- 2. get_kanban_columns_limited (accepts uuid[])
-- =============================================
CREATE OR REPLACE FUNCTION public.get_kanban_columns_limited(
  p_empresa_id uuid,
  p_per_column integer DEFAULT 20,
  p_prospeccao_ids uuid[] DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL
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
  SELECT tipo_acesso INTO v_user_tipo
  FROM public.profiles
  WHERE id = auth.uid();
  
  v_is_limited := v_user_tipo IN ('SDR'::tipo_acesso, 'Vendedor'::tipo_acesso);
  
  IF NOT v_is_limited THEN
    RETURN get_kanban_columns(p_empresa_id, p_per_column, p_prospeccao_ids, p_responsavel, p_search);
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
          AND c.status::text = 'Novo'
          AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
          AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
          AND (p_search IS NULL OR 
               c.nome ILIKE '%' || p_search || '%' OR 
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id
              AND em.user_id = auth.uid()
          );
        
        SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
        FROM (
          SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
                 c.responsavel_email, c.observacoes, c.origem::text as origem,
                 c.created_at, c.updated_at, c.vendedor_nome
          FROM contatos c
          INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
          WHERE c.empresa_id = p_empresa_id
            AND c.status::text = 'Novo'
            AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
            AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id
                AND em.user_id = auth.uid()
            )
          ORDER BY c.id, c.updated_at DESC
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
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id
              AND em.user_id = auth.uid()
          );
        
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
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id
                AND em.user_id = auth.uid()
            )
          ORDER BY c.id, c.updated_at DESC
          LIMIT v_novo_limit
        ) sub;
      END IF;
      
      v_count := LEAST(v_count, 30);
      
    ELSE
      IF v_has_filter THEN
        SELECT COUNT(DISTINCT c.id) INTO v_count
        FROM contatos c
        INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
        WHERE c.empresa_id = p_empresa_id
          AND c.status::text = v_status
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
          AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
          AND (p_search IS NULL OR 
               c.nome ILIKE '%' || p_search || '%' OR 
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id
              AND em.user_id = auth.uid()
          );
        
        SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_items
        FROM (
          SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
                 c.responsavel_email, c.observacoes, c.origem::text as origem,
                 c.created_at, c.updated_at, c.vendedor_nome
          FROM contatos c
          INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
          WHERE c.empresa_id = p_empresa_id
            AND c.status::text = v_status
            AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
            AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
            AND (p_search IS NULL OR 
                 c.nome ILIKE '%' || p_search || '%' OR 
                 c.telefone ILIKE '%' || p_search || '%' OR
                 CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id
                AND em.user_id = auth.uid()
            )
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
          AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
          AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
          AND (p_search IS NULL OR 
               c.nome ILIKE '%' || p_search || '%' OR 
               c.telefone ILIKE '%' || p_search || '%' OR
               CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
          AND EXISTS (
            SELECT 1 FROM prospeccao_equipes eq
            JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
            WHERE eq.prospeccao_id = ep.prospeccao_id
              AND em.user_id = auth.uid()
          );
        
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
            AND EXISTS (
              SELECT 1 FROM prospeccao_equipes eq
              JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
              WHERE eq.prospeccao_id = ep.prospeccao_id
                AND em.user_id = auth.uid()
            )
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

-- =============================================
-- 3. get_contatos_paginated (accepts uuid[])
-- =============================================
CREATE OR REPLACE FUNCTION public.get_contatos_paginated(
  p_empresa_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_prospeccao_ids uuid[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_column text DEFAULT 'updated_at',
  p_sort_direction text DEFAULT 'desc'
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
BEGIN
  SELECT pr.tipo_acesso INTO v_tipo_acesso
  FROM profiles pr WHERE pr.id = auth.uid();

  IF v_tipo_acesso IN ('Vendedor', 'SDR') THEN
    v_is_limited := true;
    SELECT au.email INTO v_user_email
    FROM auth.users au WHERE au.id = auth.uid();
  END IF;

  IF v_has_filter THEN
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
    WHERE c.empresa_id = p_empresa_id
      AND (p_status IS NULL OR c.status::text = p_status)
      AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
      AND (p_search IS NULL OR 
           c.nome ILIKE '%' || p_search || '%' OR 
           c.telefone ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email);

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status, 
             c.responsavel_email, c.observacoes, c.origem::text as origem, 
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id AND ep.prospeccao_id = ANY(p_prospeccao_ids)
      WHERE c.empresa_id = p_empresa_id
        AND (p_status IS NULL OR c.status::text = p_status)
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             c.email ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
      ORDER BY c.id, c.updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  ELSE
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
    WHERE c.empresa_id = p_empresa_id
      AND (p_status IS NULL OR c.status::text = p_status)
      AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
      AND (p_search IS NULL OR 
           c.nome ILIKE '%' || p_search || '%' OR 
           c.telefone ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
      AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email);

    SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb) INTO v_contatos
    FROM (
      SELECT DISTINCT ON (c.id) c.id, c.lead_id, c.nome, c.telefone, c.email, c.status::text as status,
             c.responsavel_email, c.observacoes, c.origem::text as origem,
             c.created_at, c.updated_at, c.vendedor_nome, c.data_disparo_ia
      FROM contatos c
      INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
      INNER JOIN prospeccoes p ON p.id = ep.prospeccao_id AND p.empresa_id = p_empresa_id
      WHERE c.empresa_id = p_empresa_id
        AND (p_status IS NULL OR c.status::text = p_status)
        AND (p_responsavel IS NULL OR c.responsavel_email = p_responsavel)
        AND (p_search IS NULL OR 
             c.nome ILIKE '%' || p_search || '%' OR 
             c.telefone ILIKE '%' || p_search || '%' OR
             c.email ILIKE '%' || p_search || '%' OR
             CAST(c.lead_id AS text) ILIKE '%' || p_search || '%')
        AND (NOT v_is_limited OR c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_email)
      ORDER BY c.id, c.updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'contatos', v_contatos
  );
END;
$function$;
