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
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH ultimo_log AS (
    SELECT DISTINCT ON (l.contato_id, l.prospeccao_id)
      l.contato_id,
      l.prospeccao_id,
      l.status_novo::text AS status_esperado,
      l.status_anterior::text AS status_anterior,
      l.usuario_id AS usuario_log_id,
      l.vendedor_atendimento_nome,
      l.vendedor_atendimento_email,
      l.observacoes AS ultima_observacao,
      COALESCE(l.data_movimentacao, l.created_at) AS ultima_alteracao
    FROM public.logs_movimentacao_contatos l
    WHERE (p_prospeccao_ids IS NULL OR l.prospeccao_id = ANY(p_prospeccao_ids))
    ORDER BY l.contato_id, l.prospeccao_id, COALESCE(l.data_movimentacao, l.created_at) DESC, l.created_at DESC
  ),
  divergentes AS (
    SELECT
      c.id AS contato_id,
      c.nome AS contato_nome,
      c.telefone AS telefone,
      c.empresa_id,
      e.nome_empresa AS loja_nome,
      p.id AS prospeccao_id,
      p.titulo AS evento_titulo,
      p.data_fim AS evento_data_fim,
      p.encerrado_at AS evento_encerrado_at,
      c.status::text AS status_atual,
      u.status_esperado,
      u.status_anterior,
      c.responsavel_email AS responsavel_atual,
      COALESCE(u.vendedor_atendimento_nome, pr_log.nome_completo) AS responsavel_no_log,
      COALESCE(u.vendedor_atendimento_email, pr_log.email) AS responsavel_email_no_log,
      u.ultima_observacao,
      u.ultima_alteracao
    FROM ultimo_log u
    JOIN public.contatos c ON c.id = u.contato_id
    JOIN public.prospeccoes p ON p.id = u.prospeccao_id
    JOIN public.empresas e ON e.id = c.empresa_id
    LEFT JOIN public.profiles pr_log ON pr_log.id = u.usuario_log_id
    WHERE COALESCE(c.status::text, '') <> COALESCE(u.status_esperado, '')
      AND (p_empresa_ids IS NULL OR c.empresa_id = ANY(p_empresa_ids))
      AND (p_status_atual IS NULL OR c.status::text = ANY(p_status_atual))
      AND (p_status_esperado IS NULL OR u.status_esperado = ANY(p_status_esperado))
      AND (p_data_de IS NULL OR u.ultima_alteracao >= p_data_de)
      AND (p_data_ate IS NULL OR u.ultima_alteracao <= p_data_ate)
      AND (
        p_search IS NULL OR p_search = ''
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone ILIKE '%' || p_search || '%'
      )
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*)::int FROM divergentes),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(paged.*) ORDER BY paged.ultima_alteracao DESC NULLS LAST)
      FROM (
        SELECT *
        FROM divergentes
        ORDER BY ultima_alteracao DESC NULLS LAST
        LIMIT v_limit OFFSET v_offset
      ) paged
    ), '[]'::jsonb),
    'por_loja', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'empresa_id', grouped.empresa_id,
        'loja_nome', grouped.loja_nome,
        'total', grouped.total
      ) ORDER BY grouped.total DESC)
      FROM (
        SELECT empresa_id, loja_nome, COUNT(*)::int AS total
        FROM divergentes
        GROUP BY empresa_id, loja_nome
      ) grouped
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_status_divergente(uuid[], uuid[], text[], text[], text, timestamptz, timestamptz, integer, integer) TO service_role;