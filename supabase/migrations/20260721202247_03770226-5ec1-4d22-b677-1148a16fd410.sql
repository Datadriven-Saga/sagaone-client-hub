
-- =========================================================
-- Diagnóstico de Eventos - RPCs administrativas
-- =========================================================

-- Guard helper: is admin/TI?
CREATE OR REPLACE FUNCTION public.is_admin_diagnostico(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND tipo_acesso IN ('Administrador','TI')
      AND is_active IS NOT FALSE
  );
$$;

-- ---------------------------------------------------------
-- KPIs
-- ---------------------------------------------------------
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
  v_result    jsonb;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
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
    'status_breakdown', COALESCE((SELECT jsonb_object_agg(status_evento, total) FROM status_agg), '{}'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------
-- Leads paginados
-- ---------------------------------------------------------
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
  v_offset    int := GREATEST((COALESCE(page_num,1) - 1) * COALESCE(page_size,25), 0);
  v_total     int;
  v_rows      jsonb;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _tmp_diag ON COMMIT DROP AS SELECT 1 WHERE false;

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

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows, 'page', page_num, 'page_size', page_size);
END;
$$;

-- ---------------------------------------------------------
-- Bulk reatribuir (pares contato/evento)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_reatribuir_leads_diagnostico(
  pares jsonb,
  novo_responsavel_id uuid,
  motivo text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count int := 0;
  v_par jsonb;
  v_contato uuid;
  v_prosp uuid;
  v_status_atual text;
BEGIN
  IF NOT public.is_admin_diagnostico(v_actor) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF novo_responsavel_id IS NULL THEN
    RAISE EXCEPTION 'Novo responsável obrigatório';
  END IF;

  FOR v_par IN SELECT * FROM jsonb_array_elements(pares)
  LOOP
    v_contato := (v_par->>'contato_id')::uuid;
    v_prosp   := (v_par->>'prospeccao_id')::uuid;
    IF v_contato IS NULL OR v_prosp IS NULL THEN CONTINUE; END IF;

    v_status_atual := public.get_contato_status_por_evento(v_contato, v_prosp);

    UPDATE public.eventos_prospeccao
       SET usuario_id = novo_responsavel_id
     WHERE contato_id = v_contato AND prospeccao_id = v_prosp;

    INSERT INTO public.logs_movimentacao_contatos
      (contato_id, prospeccao_id, status_anterior, status_novo, data_movimentacao, usuario_id, observacoes)
    VALUES
      (v_contato, v_prosp, v_status_atual, 'Atribuído', now(), v_actor,
       COALESCE('diagnostico-eventos: '||motivo, 'diagnostico-eventos: reatribuição'));

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------
-- Bulk alterar data_fim
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_alterar_data_fim_diagnostico(
  prospeccao_ids uuid[],
  nova_data date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF nova_data IS NULL THEN
    RAISE EXCEPTION 'Nova data obrigatória';
  END IF;

  UPDATE public.prospeccoes
     SET data_fim = nova_data, updated_at = now()
   WHERE id = ANY(prospeccao_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------
-- Encerrar evento (marca leads pendentes como Descartado)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encerrar_evento_diagnostico(
  prospeccao_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_descartados int := 0;
  v_contato uuid;
  v_status_atual text;
BEGIN
  IF NOT public.is_admin_diagnostico(v_actor) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.prospeccoes
     SET encerrado_at = COALESCE(encerrado_at, now()),
         ativo = false,
         updated_at = now()
   WHERE id = prospeccao_id_param;

  -- Marca leads sem responsável como Descartado
  FOR v_contato IN
    SELECT DISTINCT ep.contato_id
      FROM public.eventos_prospeccao ep
     WHERE ep.prospeccao_id = prospeccao_id_param
       AND ep.usuario_id IS NULL
  LOOP
    v_status_atual := public.get_contato_status_por_evento(v_contato, prospeccao_id_param);
    IF v_status_atual NOT IN ('Descartado','Confirmado','Check-in','Vendas','Opt-out') THEN
      INSERT INTO public.logs_movimentacao_contatos
        (contato_id, prospeccao_id, status_anterior, status_novo, data_movimentacao, usuario_id, observacoes)
      VALUES
        (v_contato, prospeccao_id_param, v_status_atual, 'Descartado', now(), v_actor,
         'diagnostico-eventos: evento encerrado');
      v_descartados := v_descartados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('descartados', v_descartados);
END;
$$;

-- ---------------------------------------------------------
-- Filtros: opções para dropdowns
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_diagnostico_filtros_opcoes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_diagnostico(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome_empresa) ORDER BY nome_empresa)
      FROM public.empresas
      WHERE id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
    ), '[]'::jsonb),
    'prospeccoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'titulo', p.titulo, 'empresa_id', p.empresa_id,
        'data_fim', p.data_fim, 'encerrado_at', p.encerrado_at
      ) ORDER BY p.data_fim DESC NULLS LAST)
      FROM public.prospeccoes p
      WHERE p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
        AND (p.data_fim IS NULL OR p.data_fim >= (CURRENT_DATE - INTERVAL '180 days')::date)
    ), '[]'::jsonb),
    'terceiros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr.id, 'nome', pr.nome_completo, 'foto_url', pr.foto_url
      ) ORDER BY pr.nome_completo)
      FROM public.profiles pr
      WHERE pr.is_external = true AND pr.is_active IS NOT FALSE
    ), '[]'::jsonb),
    'seats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'profile_id', s.profile_id, 'prospeccao_id', s.prospeccao_id,
        'empresa_id', s.empresa_id
      ) ORDER BY s.created_at DESC)
      FROM public.external_access_seats s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_diagnostico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_eventos_kpis(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_eventos_leads(jsonb, int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reatribuir_leads_diagnostico(jsonb, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_alterar_data_fim_diagnostico(uuid[], date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_evento_diagnostico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diagnostico_filtros_opcoes() TO authenticated;
