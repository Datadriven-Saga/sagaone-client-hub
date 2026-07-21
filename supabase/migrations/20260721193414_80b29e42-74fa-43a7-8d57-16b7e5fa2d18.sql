CREATE OR REPLACE FUNCTION public.debug_auto_atribuicao_leads(
  user_id_param uuid DEFAULT auth.uid(),
  prospeccao_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
  v_user_nome text;
  v_empresa_id uuid;
  v_leads_pendentes integer := 0;
  v_leads_a_atribuir integer := 0;
  v_status_counts jsonb := '[]'::jsonb;
  v_prospeccoes jsonb := '[]'::jsonb;
  v_novos_total integer := 0;
  v_elegiveis_total integer := 0;
  v_bloqueios jsonb := '[]'::jsonb;
  v_amostras_elegiveis jsonb := '[]'::jsonb;
  v_amostras_bloqueadas jsonb := '[]'::jsonb;
BEGIN
  SELECT
    public.get_current_user_email(),
    p.nome_completo,
    public.get_user_active_company(user_id_param)
  INTO v_user_email, v_user_nome, v_empresa_id
  FROM public.profiles p
  WHERE p.id = user_id_param;

  v_leads_pendentes := COALESCE(public.count_vendedor_leads_pendentes(user_id_param), 0);
  v_leads_a_atribuir := GREATEST(0, 30 - v_leads_pendentes);

  WITH scoped_prospeccoes AS (
    SELECT pr.id, pr.titulo, pr.canal, pr.ativo, pr.encerrado_at
    FROM public.prospeccoes pr
    WHERE pr.empresa_id = v_empresa_id
      AND (prospeccao_id_param IS NULL OR pr.id = prospeccao_id_param)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'prospeccao_id', id,
    'titulo', titulo,
    'canal', canal,
    'ativo', ativo,
    'encerrado_at', encerrado_at,
    'usuario_tem_equipe', EXISTS (
      SELECT 1
      FROM public.prospeccao_equipes eq
      JOIN public.prospeccao_equipe_membros em ON em.equipe_id = eq.id
      WHERE eq.prospeccao_id = scoped_prospeccoes.id
        AND em.user_id = user_id_param
    ),
    'usuario_tem_cadeira_externa', EXISTS (
      SELECT 1
      FROM public.external_access_seats eas
      WHERE eas.prospeccao_id = scoped_prospeccoes.id
        AND eas.empresa_id = v_empresa_id
        AND eas.user_id = user_id_param
        AND eas.status = 'active'
    )
  ) ORDER BY titulo), '[]'::jsonb)
  INTO v_prospeccoes
  FROM scoped_prospeccoes;

  WITH scoped_links AS (
    SELECT c.id AS contato_id,
           ep.prospeccao_id,
           public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status_evento
    FROM public.contatos c
    JOIN public.eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN public.prospeccoes pr ON pr.id = ep.prospeccao_id
    WHERE c.empresa_id = v_empresa_id
      AND pr.empresa_id = v_empresa_id
      AND (prospeccao_id_param IS NULL OR ep.prospeccao_id = prospeccao_id_param)
      AND (c.responsavel_email = v_user_email OR c.vendedor_nome = v_user_nome)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status_evento, 'total', total) ORDER BY status_evento), '[]'::jsonb)
  INTO v_status_counts
  FROM (
    SELECT status_evento, COUNT(DISTINCT contato_id)::integer AS total
    FROM scoped_links
    GROUP BY status_evento
  ) s;

  WITH candidates AS (
    SELECT DISTINCT ON (c.id)
      c.id AS contato_id,
      c.nome,
      c.lead_id,
      c.responsavel_email,
      c.vendedor_nome,
      c.status AS status_global,
      ep.prospeccao_id,
      pr.titulo AS prospeccao_titulo,
      pr.canal,
      pr.ativo,
      pr.encerrado_at,
      ep.created_at,
      public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status_evento,
      EXISTS (
        SELECT 1
        FROM public.prospeccao_equipes eq
        JOIN public.prospeccao_equipe_membros em ON em.equipe_id = eq.id
        WHERE eq.prospeccao_id = ep.prospeccao_id
          AND em.user_id = user_id_param
      ) AS tem_equipe,
      EXISTS (
        SELECT 1
        FROM public.external_access_seats eas
        WHERE eas.prospeccao_id = ep.prospeccao_id
          AND eas.empresa_id = v_empresa_id
          AND eas.user_id = user_id_param
          AND eas.status = 'active'
      ) AS tem_cadeira_externa
    FROM public.contatos c
    JOIN public.eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN public.prospeccoes pr ON pr.id = ep.prospeccao_id
    WHERE c.empresa_id = v_empresa_id
      AND pr.empresa_id = v_empresa_id
      AND (prospeccao_id_param IS NULL OR ep.prospeccao_id = prospeccao_id_param)
    ORDER BY c.id, ep.created_at DESC
  ), classified AS (
    SELECT *,
      CASE
        WHEN canal NOT IN ('Grande Evento', 'Mensal') THEN 'canal_nao_permitido'
        WHEN ativo IS DISTINCT FROM true OR encerrado_at IS NOT NULL THEN 'evento_inativo_ou_encerrado'
        WHEN status_evento <> 'Novo' THEN 'status_evento_nao_novo'
        WHEN COALESCE(responsavel_email, '') <> '' THEN 'ja_tem_responsavel_email'
        WHEN COALESCE(vendedor_nome, '') <> '' THEN 'ja_tem_vendedor_nome'
        WHEN tem_equipe IS NOT TRUE THEN 'sem_vinculo_equipe_rpc'
        ELSE 'elegivel_pela_rpc_atual'
      END AS motivo
    FROM candidates
  )
  SELECT
    COUNT(*) FILTER (WHERE status_evento = 'Novo')::integer,
    COUNT(*) FILTER (WHERE motivo = 'elegivel_pela_rpc_atual')::integer,
    COALESCE(jsonb_agg(jsonb_build_object('motivo', motivo, 'total', total) ORDER BY motivo), '[]'::jsonb)
  INTO v_novos_total, v_elegiveis_total, v_bloqueios
  FROM (
    SELECT motivo, COUNT(*)::integer AS total
    FROM classified
    WHERE status_evento = 'Novo' OR motivo <> 'status_evento_nao_novo'
    GROUP BY motivo
  ) grouped;

  WITH candidates AS (
    SELECT DISTINCT ON (c.id)
      c.id AS contato_id,
      c.nome,
      c.lead_id,
      c.responsavel_email,
      c.vendedor_nome,
      ep.prospeccao_id,
      pr.titulo AS prospeccao_titulo,
      pr.canal,
      pr.ativo,
      pr.encerrado_at,
      ep.created_at,
      public.get_contato_status_por_evento(c.id, ep.prospeccao_id) AS status_evento,
      EXISTS (
        SELECT 1
        FROM public.prospeccao_equipes eq
        JOIN public.prospeccao_equipe_membros em ON em.equipe_id = eq.id
        WHERE eq.prospeccao_id = ep.prospeccao_id
          AND em.user_id = user_id_param
      ) AS tem_equipe,
      EXISTS (
        SELECT 1
        FROM public.external_access_seats eas
        WHERE eas.prospeccao_id = ep.prospeccao_id
          AND eas.empresa_id = v_empresa_id
          AND eas.user_id = user_id_param
          AND eas.status = 'active'
      ) AS tem_cadeira_externa
    FROM public.contatos c
    JOIN public.eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN public.prospeccoes pr ON pr.id = ep.prospeccao_id
    WHERE c.empresa_id = v_empresa_id
      AND pr.empresa_id = v_empresa_id
      AND (prospeccao_id_param IS NULL OR ep.prospeccao_id = prospeccao_id_param)
    ORDER BY c.id, ep.created_at DESC
  ), classified AS (
    SELECT *,
      CASE
        WHEN canal NOT IN ('Grande Evento', 'Mensal') THEN 'canal_nao_permitido'
        WHEN ativo IS DISTINCT FROM true OR encerrado_at IS NOT NULL THEN 'evento_inativo_ou_encerrado'
        WHEN status_evento <> 'Novo' THEN 'status_evento_nao_novo'
        WHEN COALESCE(responsavel_email, '') <> '' THEN 'ja_tem_responsavel_email'
        WHEN COALESCE(vendedor_nome, '') <> '' THEN 'ja_tem_vendedor_nome'
        WHEN tem_equipe IS NOT TRUE THEN 'sem_vinculo_equipe_rpc'
        ELSE 'elegivel_pela_rpc_atual'
      END AS motivo
    FROM candidates
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'contato_id', contato_id,
        'lead_id', lead_id,
        'nome', nome,
        'prospeccao_id', prospeccao_id,
        'prospeccao_titulo', prospeccao_titulo,
        'status_evento', status_evento,
        'tem_equipe', tem_equipe,
        'tem_cadeira_externa', tem_cadeira_externa
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM classified
        WHERE motivo = 'elegivel_pela_rpc_atual'
        ORDER BY created_at DESC
        LIMIT 10
      ) e
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'contato_id', contato_id,
        'lead_id', lead_id,
        'nome', nome,
        'prospeccao_id', prospeccao_id,
        'prospeccao_titulo', prospeccao_titulo,
        'status_evento', status_evento,
        'motivo', motivo,
        'responsavel_email_presente', COALESCE(responsavel_email, '') <> '',
        'vendedor_nome_presente', COALESCE(vendedor_nome, '') <> '',
        'tem_equipe', tem_equipe,
        'tem_cadeira_externa', tem_cadeira_externa,
        'canal', canal,
        'ativo', ativo,
        'encerrado_at', encerrado_at
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM classified
        WHERE motivo <> 'elegivel_pela_rpc_atual'
          AND status_evento = 'Novo'
        ORDER BY created_at DESC
        LIMIT 20
      ) b
    ), '[]'::jsonb)
  INTO v_amostras_elegiveis, v_amostras_bloqueadas;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', user_id_param,
      'email_usado_pela_rpc', v_user_email,
      'nome_usado_pela_rpc', v_user_nome,
      'empresa_id', v_empresa_id
    ),
    'limite', jsonb_build_object(
      'limite_total', 30,
      'pendentes_rpc', v_leads_pendentes,
      'vagas_calculadas', v_leads_a_atribuir
    ),
    'filtro', jsonb_build_object(
      'prospeccao_id_param', prospeccao_id_param
    ),
    'prospeccoes', v_prospeccoes,
    'status_usuario_no_escopo', v_status_counts,
    'novos_total_no_escopo', COALESCE(v_novos_total, 0),
    'elegiveis_pela_rpc_atual', COALESCE(v_elegiveis_total, 0),
    'quantidade_esperada_se_rpc_usar_mesma_regra', LEAST(v_leads_a_atribuir, COALESCE(v_elegiveis_total, 0)),
    'bloqueios', COALESCE(v_bloqueios, '[]'::jsonb),
    'amostras_elegiveis', v_amostras_elegiveis,
    'amostras_bloqueadas', v_amostras_bloqueadas,
    'observacao', 'Diagnóstico somente leitura. A regra real de atribuição continua em auto_atribuir_leads_vendedor.'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.debug_auto_atribuicao_leads(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_auto_atribuicao_leads(uuid, uuid) TO service_role;