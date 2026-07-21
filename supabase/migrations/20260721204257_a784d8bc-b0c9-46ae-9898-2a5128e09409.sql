
-- Fix Diagnóstico de Eventos RPCs

CREATE OR REPLACE FUNCTION public.get_diagnostico_eventos_kpis(filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terceiros uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'terceiro_ids','[]'::jsonb)) x), NULL);
  v_empresas  uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'empresa_ids','[]'::jsonb)) x), NULL);
  v_prosp     uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'prospeccao_ids','[]'::jsonb)) x), NULL);
  v_seats     uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'seat_ids','[]'::jsonb)) x), NULL);
  v_data_de   date   := NULLIF(filtros->>'data_de','')::date;
  v_data_ate  date   := NULLIF(filtros->>'data_ate','')::date;
  v_has_filter boolean;
  v_result    jsonb;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_has_filter := (v_terceiros IS NOT NULL) OR (v_empresas IS NOT NULL) OR (v_prosp IS NOT NULL)
                  OR (v_seats IS NOT NULL) OR (v_data_de IS NOT NULL) OR (v_data_ate IS NOT NULL);

  IF NOT v_has_filter THEN
    RETURN jsonb_build_object(
      'total_leads', 0, 'eventos_total', 0, 'eventos_ativos', 0, 'eventos_encerrados', 0,
      'eventos_pausados', 0, 'eventos_expirados', 0, 'eventos_expirados_leads_pendentes', 0,
      'leads_atribuidos', 0, 'leads_nao_atribuidos', 0, 'lojas_count', 0, 'leads_por_loja', 0,
      'status_breakdown', '{}'::jsonb,
      'requires_filter', true
    );
  END IF;

  WITH prosp_scope AS (
    SELECT p.*
    FROM public.prospeccoes p
    WHERE (v_empresas IS NULL OR p.empresa_id = ANY(v_empresas))
      AND (v_prosp IS NULL OR p.id = ANY(v_prosp))
      AND (v_data_de IS NULL OR p.data_fim IS NULL OR p.data_fim >= v_data_de)
      AND (v_data_ate IS NULL OR p.data_inicio IS NULL OR p.data_inicio <= v_data_ate)
      AND p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
  ),
  leads_scope AS (
    SELECT DISTINCT c.id AS contato_id, ep.prospeccao_id, c.empresa_id,
           public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status_evento,
           ep.usuario_id AS responsavel_id
    FROM public.eventos_prospeccao ep
    JOIN public.contatos c ON c.id = ep.contato_id
    JOIN prosp_scope ps ON ps.id = ep.prospeccao_id
    LEFT JOIN public.external_access_seats s ON s.profile_id = ep.usuario_id AND s.prospeccao_id = ep.prospeccao_id
    WHERE (v_terceiros IS NULL OR ep.usuario_id = ANY(v_terceiros))
      AND (v_seats IS NULL OR s.id = ANY(v_seats))
  ),
  status_agg AS (
    SELECT status_evento, COUNT(*)::int AS total FROM leads_scope GROUP BY status_evento
  )
  SELECT jsonb_build_object(
    'total_leads', (SELECT COUNT(*) FROM leads_scope),
    'eventos_total', (SELECT COUNT(*) FROM prosp_scope),
    'eventos_ativos', (SELECT COUNT(*) FROM prosp_scope WHERE ativo = true AND encerrado_at IS NULL AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)),
    'eventos_encerrados', (SELECT COUNT(*) FROM prosp_scope WHERE encerrado_at IS NOT NULL),
    'eventos_pausados', (SELECT COUNT(*) FROM prosp_scope WHERE disparos_pausados = true),
    'eventos_expirados', (SELECT COUNT(*) FROM prosp_scope WHERE encerrado_at IS NULL AND data_fim IS NOT NULL AND data_fim < CURRENT_DATE),
    'eventos_expirados_leads_pendentes', (
      SELECT COUNT(*) FROM leads_scope ls
      JOIN prosp_scope ps ON ps.id = ls.prospeccao_id
      WHERE ps.encerrado_at IS NULL AND ps.data_fim IS NOT NULL AND ps.data_fim < CURRENT_DATE
        AND ls.status_evento NOT IN ('Confirmado','Check-in','Vendas','Descartado','Opt-out')
    ),
    'leads_atribuidos', (SELECT COUNT(*) FROM leads_scope WHERE responsavel_id IS NOT NULL AND status_evento = 'Atribuído'),
    'leads_nao_atribuidos', (SELECT COUNT(*) FROM leads_scope WHERE responsavel_id IS NULL),
    'lojas_count', (SELECT COUNT(DISTINCT empresa_id) FROM prosp_scope),
    'leads_por_loja', (
      SELECT CASE WHEN COUNT(DISTINCT empresa_id) = 0 THEN 0
                  ELSE (COUNT(*) / COUNT(DISTINCT empresa_id))::int END
      FROM leads_scope
    ),
    'status_breakdown', COALESCE((SELECT jsonb_object_agg(status_evento, total) FROM status_agg), '{}'::jsonb),
    'requires_filter', false
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_diagnostico_eventos_leads(
  filtros jsonb DEFAULT '{}'::jsonb,
  page_num int DEFAULT 1,
  page_size int DEFAULT 25,
  search_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terceiros uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'terceiro_ids','[]'::jsonb)) x), NULL);
  v_empresas  uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'empresa_ids','[]'::jsonb)) x), NULL);
  v_prosp     uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'prospeccao_ids','[]'::jsonb)) x), NULL);
  v_seats     uuid[] := COALESCE((SELECT array_agg((x)::uuid) FROM jsonb_array_elements_text(COALESCE(filtros->'seat_ids','[]'::jsonb)) x), NULL);
  v_data_de   date   := NULLIF(filtros->>'data_de','')::date;
  v_data_ate  date   := NULLIF(filtros->>'data_ate','')::date;
  v_has_filter boolean;
  v_offset    int := GREATEST((COALESCE(page_num,1) - 1) * COALESCE(page_size,25), 0);
  v_total     int;
  v_rows      jsonb;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_has_filter := (v_terceiros IS NOT NULL) OR (v_empresas IS NOT NULL) OR (v_prosp IS NOT NULL)
                  OR (v_seats IS NOT NULL) OR (v_data_de IS NOT NULL) OR (v_data_ate IS NOT NULL);

  IF NOT v_has_filter THEN
    RETURN jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'page', page_num, 'page_size', page_size, 'requires_filter', true);
  END IF;

  WITH prosp_scope AS (
    SELECT p.id, p.titulo, p.empresa_id, p.data_fim, p.encerrado_at, p.disparos_pausados, p.ativo
    FROM public.prospeccoes p
    WHERE (v_empresas IS NULL OR p.empresa_id = ANY(v_empresas))
      AND (v_prosp IS NULL OR p.id = ANY(v_prosp))
      AND (v_data_de IS NULL OR p.data_fim IS NULL OR p.data_fim >= v_data_de)
      AND (v_data_ate IS NULL OR p.data_inicio IS NULL OR p.data_inicio <= v_data_ate)
      AND p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
  ),
  base AS (
    SELECT DISTINCT ON (c.id, ep.prospeccao_id)
      c.id AS contato_id,
      ep.prospeccao_id,
      c.nome,
      c.telefone,
      c.empresa_id,
      ep.usuario_id AS responsavel_id,
      s.id AS seat_id,
      ps.titulo AS evento_titulo,
      ps.data_fim,
      ps.encerrado_at,
      public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status_evento
    FROM public.eventos_prospeccao ep
    JOIN public.contatos c ON c.id = ep.contato_id
    JOIN prosp_scope ps ON ps.id = ep.prospeccao_id
    LEFT JOIN public.external_access_seats s ON s.profile_id = ep.usuario_id AND s.prospeccao_id = ep.prospeccao_id
    WHERE (v_terceiros IS NULL OR ep.usuario_id = ANY(v_terceiros))
      AND (v_seats IS NULL OR s.id = ANY(v_seats))
      AND (search_term IS NULL OR search_term = '' OR c.nome ILIKE '%'||search_term||'%' OR c.telefone ILIKE '%'||search_term||'%')
  ),
  base_enriched AS (
    SELECT b.*,
           e.nome_empresa AS loja_nome,
           pr.nome_completo AS responsavel_nome,
           pr.foto_url AS responsavel_foto
    FROM base b
    LEFT JOIN public.empresas e ON e.id = b.empresa_id
    LEFT JOIN public.profiles pr ON pr.id = b.responsavel_id
  )
  SELECT
    (SELECT COUNT(*) FROM base_enriched),
    COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM base_enriched
        ORDER BY data_fim DESC NULLS LAST, evento_titulo, nome
        OFFSET v_offset LIMIT COALESCE(page_size,25)
      ) t
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows, 'page', page_num, 'page_size', page_size, 'requires_filter', false);
END;
$$;
