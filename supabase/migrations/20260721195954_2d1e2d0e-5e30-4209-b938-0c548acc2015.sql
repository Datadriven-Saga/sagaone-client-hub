
-- 1) count_vendedor_leads_pendentes agora aceita prospeccao_id opcional
CREATE OR REPLACE FUNCTION public.count_vendedor_leads_pendentes(
  user_id_param uuid,
  prospeccao_id_param uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT get_user_active_company(user_id_param) AS emp,
           get_current_user_email() AS email,
           (SELECT p.nome_completo FROM profiles p WHERE p.id = user_id_param) AS nome
  )
  SELECT COALESCE(COUNT(DISTINCT c.id)::integer, 0)
  FROM me, public.contatos c
  WHERE c.empresa_id = me.emp
    AND (c.responsavel_email = me.email OR c.vendedor_nome = me.nome)
    AND EXISTS (
      SELECT 1
      FROM public.eventos_prospeccao ep
      JOIN public.prospeccoes pr ON pr.id = ep.prospeccao_id
      WHERE ep.contato_id = c.id
        AND pr.ativo = true
        AND pr.encerrado_at IS NULL
        AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
        AND (prospeccao_id_param IS NULL OR ep.prospeccao_id = prospeccao_id_param)
        AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Atribuído'
    );
$function$;

-- 2) vendedor_precisa_leads repassa evento
CREATE OR REPLACE FUNCTION public.vendedor_precisa_leads(
  user_id_param uuid DEFAULT auth.uid(),
  prospeccao_id_param uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.count_vendedor_leads_pendentes(user_id_param, prospeccao_id_param) < 30;
$function$;

-- 3) auto_atribuir_leads_vendedor com escopo por evento
CREATE OR REPLACE FUNCTION public.auto_atribuir_leads_vendedor(
  user_id_param uuid DEFAULT auth.uid(),
  prospeccao_id_param uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  leads_pendentes integer;
  leads_a_atribuir integer;
  user_email text;
  user_nome text;
  empresa_id_param uuid;
  leads_atribuidos integer := 0;
  evento_valido boolean;
BEGIN
  SELECT
    get_current_user_email(),
    p.nome_completo,
    get_user_active_company(user_id_param)
  INTO user_email, user_nome, empresa_id_param
  FROM profiles p
  WHERE p.id = user_id_param;

  -- Se um evento foi passado, valida que ele está ativo/não-encerrado/dentro do prazo
  IF prospeccao_id_param IS NOT NULL THEN
    SELECT (pr.ativo = true
            AND pr.encerrado_at IS NULL
            AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
            AND pr.canal IN ('Grande Evento', 'Mensal'))
      INTO evento_valido
      FROM public.prospeccoes pr
     WHERE pr.id = prospeccao_id_param
       AND pr.empresa_id = empresa_id_param;

    IF NOT COALESCE(evento_valido, false) THEN
      RETURN 0;
    END IF;
  END IF;

  leads_pendentes := public.count_vendedor_leads_pendentes(user_id_param, prospeccao_id_param);
  leads_a_atribuir := GREATEST(0, 30 - leads_pendentes);

  IF leads_a_atribuir <= 0 THEN
    RETURN 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _tmp_leads_pick (
    contato_id uuid PRIMARY KEY,
    prospeccao_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _tmp_leads_pick (contato_id, prospeccao_id)
  SELECT DISTINCT ON (c.id) c.id, ep.prospeccao_id
  FROM contatos c
  INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
  INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id
    AND pr.empresa_id = empresa_id_param
    AND pr.canal IN ('Grande Evento', 'Mensal')
    AND pr.ativo = true
    AND pr.encerrado_at IS NULL
    AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
  WHERE c.empresa_id = empresa_id_param
    AND (prospeccao_id_param IS NULL OR ep.prospeccao_id = prospeccao_id_param)
    AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
    AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
    AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Novo'
    AND EXISTS (
      SELECT 1 FROM prospeccao_equipes eq
      JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
      WHERE eq.prospeccao_id = ep.prospeccao_id
        AND em.user_id = user_id_param
    )
  ORDER BY c.id, ep.created_at DESC
  LIMIT leads_a_atribuir;

  PERFORM set_config('app.status_change_logged', 'true', true);

  UPDATE contatos c
     SET responsavel_email = user_email,
         vendedor_nome     = user_nome,
         status            = 'Atribuído'::status_lead,
         updated_at        = now()
    FROM _tmp_leads_pick t
   WHERE c.id = t.contato_id;

  GET DIAGNOSTICS leads_atribuidos = ROW_COUNT;

  INSERT INTO logs_movimentacao_contatos
    (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes)
  SELECT t.contato_id, t.prospeccao_id, 'Novo', 'Atribuído', user_id_param,
         'auto-atribuição SDR/Vendedor'
  FROM _tmp_leads_pick t;

  RETURN leads_atribuidos;
END;
$function$;

-- 4) debug_auto_atribuicao_leads usa o novo parâmetro para pendentes
CREATE OR REPLACE FUNCTION public.debug_auto_atribuicao_leads(
  user_id_param uuid DEFAULT auth.uid(),
  prospeccao_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
  v_user_nome text;
  v_empresa_id uuid;
  v_pendentes_no_evento integer := 0;
  v_pendentes_global integer := 0;
  v_leads_a_atribuir integer := 0;
BEGIN
  SELECT
    public.get_current_user_email(),
    p.nome_completo,
    public.get_user_active_company(user_id_param)
  INTO v_user_email, v_user_nome, v_empresa_id
  FROM public.profiles p
  WHERE p.id = user_id_param;

  v_pendentes_global := COALESCE(public.count_vendedor_leads_pendentes(user_id_param, NULL), 0);
  v_pendentes_no_evento := COALESCE(public.count_vendedor_leads_pendentes(user_id_param, prospeccao_id_param), 0);
  v_leads_a_atribuir := GREATEST(0, 30 - v_pendentes_no_evento);

  RETURN jsonb_build_object(
    'user', jsonb_build_object('id', user_id_param, 'email', v_user_email, 'nome', v_user_nome, 'empresa_id', v_empresa_id),
    'filtro', jsonb_build_object('prospeccao_id', prospeccao_id_param),
    'limite', jsonb_build_object(
      'limite_total', 30,
      'pendentes_rpc', v_pendentes_no_evento,
      'pendentes_global', v_pendentes_global,
      'vagas_calculadas', v_leads_a_atribuir
    ),
    'observacao', 'Diagnóstico somente leitura. pendentes_rpc = escopo do evento; pendentes_global = todos os eventos ativos.'
  );
END;
$function$;
