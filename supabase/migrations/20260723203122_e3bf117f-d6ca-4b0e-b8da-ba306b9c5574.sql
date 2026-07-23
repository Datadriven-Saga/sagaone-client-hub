CREATE OR REPLACE FUNCTION public.normalize_lead_status_label(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  WITH normalized AS (
    SELECT lower(regexp_replace(btrim(COALESCE(p_status, '')), '[\s_-]+', '', 'g')) AS value
  )
  SELECT CASE
    WHEN p_status IS NULL OR btrim(p_status) = '' THEN NULL
    WHEN value IN ('novo', 'novos') THEN 'Novo'
    WHEN value IN ('atribuído', 'atribuido', 'atribuídos', 'atribuidos') THEN 'Atribuído'
    WHEN value IN ('emespera', 'espera') THEN 'Em Espera'
    WHEN value IN ('convidado', 'convidados') THEN 'Convidado'
    WHEN value IN ('confirmado', 'confirmados') THEN 'Confirmado'
    WHEN value IN ('checkin') THEN 'Check-in'
    WHEN value IN ('venda', 'vendas', 'vendido', 'vendidos') THEN 'Venda'
    WHEN value IN ('descartado', 'descartados') THEN 'Descartado'
    WHEN value IN ('optout') THEN 'Opt Out'
    ELSE btrim(p_status)
  END
  FROM normalized;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_lead_status_label(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_lead_status_label(text) TO service_role;

CREATE INDEX IF NOT EXISTS idx_logs_mov_prosp_contato_latest_status
ON public.logs_movimentacao_contatos (prospeccao_id, contato_id, data_movimentacao DESC, created_at DESC)
WHERE status_novo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospeccoes_empresa_data_status_diag
ON public.prospeccoes (empresa_id, data_fim DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_diagnostico_status_filtros()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_result jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = v_uid
      AND pr.tipo_acesso IN ('Administrador', 'TI', 'Master')
      AND pr.is_active IS NOT FALSE
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'nome', e.nome_empresa,
        'marca', e.marca,
        'uf', e.uf
      ) ORDER BY e.nome_empresa)
      FROM public.empresas e
      WHERE e.id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
        AND EXISTS (
          SELECT 1
          FROM public.prospeccoes p
          WHERE p.empresa_id = e.id
        )
    ), '[]'::jsonb),
    'prospeccoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'titulo', p.titulo,
        'empresa_id', p.empresa_id,
        'loja_nome', e.nome_empresa,
        'data_inicio', p.data_inicio,
        'data_fim', p.data_fim,
        'encerrado_at', p.encerrado_at,
        'ativo', p.ativo,
        'event_id_pri', p.event_id_pri
      ) ORDER BY p.data_fim DESC NULLS LAST, p.created_at DESC, p.titulo)
      FROM public.prospeccoes p
      JOIN public.empresas e ON e.id = p.empresa_id
      WHERE p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
        AND EXISTS (
          SELECT 1
          FROM public.logs_movimentacao_contatos l
          WHERE l.prospeccao_id = p.id
            AND l.status_novo IS NOT NULL
        )
    ), '[]'::jsonb),
    'statuses', jsonb_build_array('Novo', 'Atribuído', 'Em Espera', 'Convidado', 'Confirmado', 'Check-in', 'Venda', 'Descartado', 'Opt Out')
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_status_filtros() TO service_role;

CREATE OR REPLACE FUNCTION public.get_leads_status_divergente(
  p_empresa_ids uuid[] DEFAULT NULL::uuid[],
  p_prospeccao_ids uuid[] DEFAULT NULL::uuid[],
  p_status_atual text[] DEFAULT NULL::text[],
  p_status_esperado text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_data_de timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_ate timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_offset integer := GREATEST(0, (COALESCE(p_page, 1) - 1)) * LEAST(500, GREATEST(1, COALESCE(p_page_size, 50)));
  v_limit integer := LEAST(500, GREATEST(1, COALESCE(p_page_size, 50)));
  v_result jsonb := '{}'::jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = v_uid
      AND pr.tipo_acesso IN ('Administrador', 'TI', 'Master')
      AND pr.is_active IS NOT FALSE
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH eventos_filtrados AS (
    SELECT p.id, p.titulo, p.empresa_id, p.data_fim, p.encerrado_at, p.event_id_pri
    FROM public.prospeccoes p
    WHERE p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
      AND (p_empresa_ids IS NULL OR p.empresa_id = ANY(p_empresa_ids))
      AND (p_prospeccao_ids IS NULL OR p.id = ANY(p_prospeccao_ids))
  ),
  ultimo_log AS (
    SELECT DISTINCT ON (l.contato_id, l.prospeccao_id)
      l.contato_id,
      l.prospeccao_id,
      public.normalize_lead_status_label(l.status_novo) AS status_esperado,
      public.normalize_lead_status_label(l.status_anterior) AS status_anterior,
      l.usuario_id AS usuario_log_id,
      NULLIF(btrim(l.vendedor_atendimento_nome), '') AS vendedor_atendimento_nome,
      NULLIF(btrim(l.vendedor_atendimento_email), '') AS vendedor_atendimento_email,
      l.observacoes AS ultima_observacao,
      COALESCE(l.data_movimentacao, l.created_at) AS ultima_alteracao
    FROM public.logs_movimentacao_contatos l
    JOIN eventos_filtrados ef ON ef.id = l.prospeccao_id
    WHERE l.contato_id IS NOT NULL
      AND l.prospeccao_id IS NOT NULL
      AND l.status_novo IS NOT NULL
      AND COALESCE(l.observacoes, '') NOT ILIKE 'auto-trigger%'
      AND COALESCE(l.observacoes, '') NOT ILIKE '%fallback de migracao%'
    ORDER BY l.contato_id, l.prospeccao_id, COALESCE(l.data_movimentacao, l.created_at) DESC, l.created_at DESC
  ),
  divergentes AS (
    SELECT
      c.id AS contato_id,
      c.nome AS contato_nome,
      c.telefone AS telefone,
      ef.empresa_id,
      c.empresa_id AS contato_empresa_id,
      e.nome_empresa AS loja_nome,
      ef.id AS prospeccao_id,
      ef.titulo AS evento_titulo,
      ef.event_id_pri,
      ef.data_fim AS evento_data_fim,
      ef.encerrado_at AS evento_encerrado_at,
      public.normalize_lead_status_label(c.status::text) AS status_atual,
      u.status_esperado,
      u.status_anterior,
      NULLIF(btrim(c.responsavel_email), '') AS responsavel_atual_email,
      NULLIF(btrim(c.vendedor_nome), '') AS responsavel_atual_nome,
      NULLIF(btrim(concat_ws(' · ', NULLIF(btrim(c.vendedor_nome), ''), NULLIF(btrim(c.responsavel_email), ''))), '') AS responsavel_atual,
      COALESCE(u.vendedor_atendimento_nome, pr_log.nome_completo) AS responsavel_no_log,
      u.vendedor_atendimento_email AS responsavel_email_no_log,
      (NULLIF(btrim(c.responsavel_email), '') IS NOT NULL OR NULLIF(btrim(c.vendedor_nome), '') IS NOT NULL) AS tem_responsavel,
      u.ultima_observacao,
      u.ultima_alteracao
    FROM ultimo_log u
    JOIN public.contatos c ON c.id = u.contato_id
    JOIN eventos_filtrados ef ON ef.id = u.prospeccao_id
    JOIN public.empresas e ON e.id = ef.empresa_id
    LEFT JOIN public.profiles pr_log ON pr_log.id = u.usuario_log_id
    WHERE public.normalize_lead_status_label(c.status::text) IS DISTINCT FROM u.status_esperado
      AND (p_status_atual IS NULL OR public.normalize_lead_status_label(c.status::text) = ANY(p_status_atual))
      AND (p_status_esperado IS NULL OR u.status_esperado = ANY(p_status_esperado))
      AND (p_data_de IS NULL OR u.ultima_alteracao >= p_data_de)
      AND (p_data_ate IS NULL OR u.ultima_alteracao <= p_data_ate)
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone ILIKE '%' || p_search || '%'
        OR ef.titulo ILIKE '%' || p_search || '%'
        OR ef.event_id_pri ILIKE '%' || p_search || '%'
        OR c.responsavel_email ILIKE '%' || p_search || '%'
        OR c.vendedor_nome ILIKE '%' || p_search || '%'
      )
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*)::int FROM divergentes),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(paged.*) ORDER BY paged.ultima_alteracao DESC NULLS LAST, paged.evento_titulo)
      FROM (
        SELECT *
        FROM divergentes
        ORDER BY ultima_alteracao DESC NULLS LAST, evento_titulo, contato_nome
        LIMIT v_limit OFFSET v_offset
      ) paged
    ), '[]'::jsonb),
    'por_loja', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'empresa_id', grouped.empresa_id,
        'loja_nome', grouped.loja_nome,
        'total', grouped.total
      ) ORDER BY grouped.total DESC, grouped.loja_nome)
      FROM (
        SELECT empresa_id, loja_nome, COUNT(*)::int AS total
        FROM divergentes
        GROUP BY empresa_id, loja_nome
      ) grouped
    ), '[]'::jsonb),
    'por_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'status_atual', grouped.status_atual,
        'status_esperado', grouped.status_esperado,
        'total', grouped.total
      ) ORDER BY grouped.total DESC)
      FROM (
        SELECT status_atual, status_esperado, COUNT(*)::int AS total
        FROM divergentes
        GROUP BY status_atual, status_esperado
      ) grouped
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO service_role;