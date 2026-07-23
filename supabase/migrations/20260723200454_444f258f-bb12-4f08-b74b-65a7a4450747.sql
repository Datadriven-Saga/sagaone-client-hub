CREATE OR REPLACE FUNCTION public.get_leads_status_divergente(
  p_empresa_ids uuid[] DEFAULT NULL,
  p_prospeccao_ids uuid[] DEFAULT NULL,
  p_status_atual text[] DEFAULT NULL,
  p_status_esperado text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_data_de timestamptz DEFAULT NULL,
  p_data_ate timestamptz DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_offset integer := GREATEST(0, (COALESCE(p_page,1) - 1)) * GREATEST(1, COALESCE(p_page_size,50));
  v_limit  integer := LEAST(500, GREATEST(1, COALESCE(p_page_size,50)));
  v_total  integer := 0;
  v_rows   jsonb;
  v_por_loja jsonb;
BEGIN
  -- Permissão: Admin/TI/Master
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid
      AND (
        pr.tipo_acesso IN ('Admin','TI','Master')
        OR pr.is_master = true
      )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  -- CTE: último log por (contato, prospeccao)
  WITH ultimo_log AS (
    SELECT DISTINCT ON (l.contato_id, l.prospeccao_id)
      l.contato_id,
      l.prospeccao_id,
      l.status_novo    AS status_esperado,
      l.status_anterior,
      l.usuario_id     AS responsavel_log_id,
      l.observacoes    AS ultima_observacao,
      l.created_at     AS ultima_alteracao
    FROM public.logs_movimentacao_contatos l
    WHERE (p_prospeccao_ids IS NULL OR l.prospeccao_id = ANY(p_prospeccao_ids))
    ORDER BY l.contato_id, l.prospeccao_id, l.created_at DESC
  ),
  divergentes AS (
    SELECT
      c.id                    AS contato_id,
      c.nome                  AS contato_nome,
      c.telefone_normalizado  AS telefone,
      c.empresa_id,
      e.nome                  AS loja_nome,
      p.id                    AS prospeccao_id,
      p.titulo                AS evento_titulo,
      p.data_fim              AS evento_data_fim,
      p.encerrado_at          AS evento_encerrado_at,
      c.status                AS status_atual,
      u.status_esperado,
      c.responsavel_email     AS responsavel_atual,
      pr_log.nome_completo    AS responsavel_no_log,
      u.ultima_observacao,
      u.ultima_alteracao
    FROM ultimo_log u
    JOIN public.contatos c        ON c.id = u.contato_id
    JOIN public.prospeccoes p     ON p.id = u.prospeccao_id
    JOIN public.empresas e        ON e.id = c.empresa_id
    LEFT JOIN public.profiles pr_log ON pr_log.id = u.responsavel_log_id
    WHERE COALESCE(c.status,'') <> COALESCE(u.status_esperado,'')
      AND (p_empresa_ids IS NULL OR c.empresa_id = ANY(p_empresa_ids))
      AND (p_status_atual IS NULL OR c.status = ANY(p_status_atual))
      AND (p_status_esperado IS NULL OR u.status_esperado = ANY(p_status_esperado))
      AND (p_data_de IS NULL OR u.ultima_alteracao >= p_data_de)
      AND (p_data_ate IS NULL OR u.ultima_alteracao <= p_data_ate)
      AND (
        p_search IS NULL OR p_search = ''
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone_normalizado ILIKE '%' || p_search || '%'
      )
  ),
  paginated AS (
    SELECT *
    FROM divergentes
    ORDER BY ultima_alteracao DESC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    COUNT(*)::int,
    COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (SELECT COUNT(*) OVER () AS __c FROM divergentes) _c
  CROSS JOIN LATERAL (SELECT * FROM paginated) p;

  -- Total real (independente da paginação)
  SELECT COUNT(*) INTO v_total FROM (
    SELECT 1 FROM public.logs_movimentacao_contatos l
    WHERE (p_prospeccao_ids IS NULL OR l.prospeccao_id = ANY(p_prospeccao_ids))
  ) _dummy WHERE false;

  -- Recalcular corretamente
  WITH ultimo_log AS (
    SELECT DISTINCT ON (l.contato_id, l.prospeccao_id)
      l.contato_id, l.prospeccao_id, l.status_novo AS status_esperado, l.created_at
    FROM public.logs_movimentacao_contatos l
    WHERE (p_prospeccao_ids IS NULL OR l.prospeccao_id = ANY(p_prospeccao_ids))
    ORDER BY l.contato_id, l.prospeccao_id, l.created_at DESC
  )
  SELECT COUNT(*)::int INTO v_total
  FROM ultimo_log u
  JOIN public.contatos c ON c.id = u.contato_id
  WHERE COALESCE(c.status,'') <> COALESCE(u.status_esperado,'')
    AND (p_empresa_ids IS NULL OR c.empresa_id = ANY(p_empresa_ids))
    AND (p_status_atual IS NULL OR c.status = ANY(p_status_atual))
    AND (p_status_esperado IS NULL OR u.status_esperado = ANY(p_status_esperado))
    AND (p_data_de IS NULL OR u.created_at >= p_data_de)
    AND (p_data_ate IS NULL OR u.created_at <= p_data_ate)
    AND (
      p_search IS NULL OR p_search = ''
      OR c.nome ILIKE '%' || p_search || '%'
      OR c.telefone_normalizado ILIKE '%' || p_search || '%'
    );

  -- Agregado por loja
  WITH ultimo_log AS (
    SELECT DISTINCT ON (l.contato_id, l.prospeccao_id)
      l.contato_id, l.prospeccao_id, l.status_novo AS status_esperado, l.created_at
    FROM public.logs_movimentacao_contatos l
    WHERE (p_prospeccao_ids IS NULL OR l.prospeccao_id = ANY(p_prospeccao_ids))
    ORDER BY l.contato_id, l.prospeccao_id, l.created_at DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'empresa_id', empresa_id,
    'loja_nome',  loja_nome,
    'total',      total
  ) ORDER BY total DESC), '[]'::jsonb) INTO v_por_loja
  FROM (
    SELECT c.empresa_id, e.nome AS loja_nome, COUNT(*)::int AS total
    FROM ultimo_log u
    JOIN public.contatos c ON c.id = u.contato_id
    JOIN public.empresas e ON e.id = c.empresa_id
    WHERE COALESCE(c.status,'') <> COALESCE(u.status_esperado,'')
      AND (p_empresa_ids IS NULL OR c.empresa_id = ANY(p_empresa_ids))
      AND (p_status_atual IS NULL OR c.status = ANY(p_status_atual))
      AND (p_status_esperado IS NULL OR u.status_esperado = ANY(p_status_esperado))
      AND (p_data_de IS NULL OR u.created_at >= p_data_de)
      AND (p_data_ate IS NULL OR u.created_at <= p_data_ate)
      AND (
        p_search IS NULL OR p_search = ''
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone_normalizado ILIKE '%' || p_search || '%'
      )
    GROUP BY c.empresa_id, e.nome
  ) g;

  RETURN jsonb_build_object(
    'total', v_total,
    'rows', v_rows,
    'por_loja', v_por_loja
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO service_role;