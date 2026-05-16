-- =========================================================================
-- PARTE 1: bulk_upsert_contatos — limpar responsável quando force_status_novo
-- =========================================================================
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(
  p_contatos jsonb,
  p_empresa_id uuid,
  p_prospeccao_id uuid DEFAULT NULL::uuid,
  p_canal text DEFAULT 'whatsapp'::text,
  p_force_status_novo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_linked int := 0;
  v_already_linked int := 0;
  v_errors int := 0;
  v_quarantined int := 0;
  v_global_blocked int := 0;
  v_responsavel_applied int := 0;
  v_responsavel_skipped int := 0;
  v_contato record;
  v_contato_id uuid;
  v_is_new boolean;
  v_marca text;
  v_data_fim_evento timestamptz;
  v_evento_nome text;
  v_in_quarantine boolean;
  v_quarentena_enabled boolean;
  v_is_teste boolean := false;
  v_error_details jsonb := '[]'::jsonb;
  v_warning_details jsonb := '[]'::jsonb;
  v_error_msg text;
  v_telefone_raw text;
  v_phone_variants text[];
  v_nome_raw text;
  v_row_index int := 0;
  v_is_excluded boolean;
  v_is_global_blocked boolean;
  v_quarentena_dias int;
  v_already_exists boolean;
  v_responsavel text;
  v_responsavel_lookup_err text;
BEGIN
  v_quarentena_enabled := public.is_feature_enabled('quarentena_marca_ativa');
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_empresa_id;

  IF p_prospeccao_id IS NOT NULL THEN
    SELECT p.data_fim::timestamptz, p.titulo, COALESCE(p.is_teste, false)
    INTO v_data_fim_evento, v_evento_nome, v_is_teste
    FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;
  END IF;

  v_quarentena_dias := public.get_quarentena_dias(p_empresa_id, v_marca, p_canal);

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
      v_row_index := v_row_index + 1;
      v_telefone_raw := COALESCE(v_contato.value->>'telefone', '');
      v_nome_raw := COALESCE(v_contato.value->>'nome', '');
      v_responsavel := NULLIF(BTRIM(v_contato.value->>'responsavel_email'), '');
      v_phone_variants := public.phone_match_variants(v_telefone_raw);

      v_is_global_blocked := public.check_global_opt_out(v_telefone_raw);
      IF v_is_global_blocked THEN
        v_global_blocked := v_global_blocked + 1;
        CONTINUE;
      END IF;

      v_is_excluded := EXISTS (
        SELECT 1 FROM public.quarentena_exclusoes
        WHERE telefone_normalizado = ANY (v_phone_variants)
      );

      v_in_quarantine := false;
      IF v_quarentena_enabled AND v_marca IS NOT NULL AND NOT v_is_teste AND NOT v_is_excluded THEN
        SELECT
          CASE
            WHEN cq.id IS NOT NULL
              AND cq.desativado = false
              AND cq.data_fim_evento IS NOT NULL
              AND now() > cq.data_fim_evento
              AND now() < (cq.data_fim_evento + (v_quarentena_dias || ' days')::interval)
            THEN true
            ELSE false
          END
        INTO v_in_quarantine
        FROM (SELECT 1) dummy
        LEFT JOIN LATERAL (
          SELECT cq2.*
          FROM public.contato_quarentena cq2
          WHERE cq2.telefone_normalizado = ANY (v_phone_variants)
            AND cq2.marca = v_marca
            AND cq2.canal = p_canal
          ORDER BY cq2.desativado ASC, cq2.data_fim_evento DESC NULLS LAST
          LIMIT 1
        ) cq ON true;
      END IF;

      IF v_in_quarantine THEN
        v_quarantined := v_quarantined + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.contatos (
        nome, telefone, email, status, origem, empresa_id,
        observacoes, responsavel_email, base_id, codigo_proposta
      ) VALUES (
        COALESCE(v_contato.value->>'nome', ''),
        v_contato.value->>'telefone',
        NULLIF(v_contato.value->>'email', ''),
        'Novo'::status_lead,
        COALESCE((v_contato.value->>'origem')::origem_lead, 'Outros'::origem_lead),
        p_empresa_id,
        NULLIF(v_contato.value->>'observacoes', ''),
        v_responsavel,
        NULLIF(v_contato.value->>'base_id', '')::uuid,
        NULLIF(v_contato.value->>'codigo_proposta', '')
      )
      ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
      DO UPDATE SET
        nome = CASE WHEN COALESCE(EXCLUDED.nome, '') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
        email = COALESCE(EXCLUDED.email, contatos.email),
        codigo_proposta = COALESCE(EXCLUDED.codigo_proposta, contatos.codigo_proposta),
        responsavel_email = CASE
          WHEN p_force_status_novo AND EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> ''
            THEN EXCLUDED.responsavel_email          -- reimport COM responsável → sobrescreve
          WHEN p_force_status_novo
            THEN NULL                                 -- reimport SEM responsável → LIMPA
          WHEN EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> ''
            THEN EXCLUDED.responsavel_email
          ELSE contatos.responsavel_email
        END,
        status = CASE
          WHEN p_force_status_novo AND EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> ''
            THEN 'Atribuído'::status_lead
          WHEN p_force_status_novo
            THEN 'Novo'::status_lead
          WHEN EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> ''
            THEN 'Atribuído'::status_lead
          ELSE contatos.status
        END,
        updated_at = now()
      RETURNING id, (xmax = 0) AS was_inserted
      INTO v_contato_id, v_is_new;

      IF v_is_new THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      IF v_responsavel IS NOT NULL AND v_responsavel <> '' THEN
        BEGIN
          UPDATE public.contatos c
          SET vendedor_nome = p.nome_completo
          FROM public.profiles p
          LEFT JOIN auth.users au ON au.id = p.id
          WHERE c.id = v_contato_id
            AND p.empresa_id = p_empresa_id
            AND (
              au.email = v_responsavel
              OR p.id::text = v_responsavel
              OR p.celular = v_responsavel
            );

          IF EXISTS (
            SELECT 1
            FROM public.profiles p
            LEFT JOIN auth.users au ON au.id = p.id
            WHERE p.empresa_id = p_empresa_id
              AND (
                au.email = v_responsavel
                OR p.id::text = v_responsavel
                OR p.celular = v_responsavel
              )
          ) THEN
            v_responsavel_applied := v_responsavel_applied + 1;
          ELSE
            v_responsavel_skipped := v_responsavel_skipped + 1;

            IF jsonb_array_length(v_warning_details) < 200 THEN
              v_warning_details := v_warning_details || jsonb_build_object(
                'type', 'responsavel_not_found',
                'value', v_responsavel,
                'telefone', v_telefone_raw,
                'nome', v_nome_raw
              );
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_responsavel_lookup_err = MESSAGE_TEXT;
          v_responsavel_skipped := v_responsavel_skipped + 1;
          IF jsonb_array_length(v_warning_details) < 200 THEN
            v_warning_details := v_warning_details || jsonb_build_object(
              'type', 'responsavel_lookup_error',
              'value', v_responsavel,
              'telefone', v_telefone_raw,
              'erro', v_responsavel_lookup_err
            );
          END IF;
        END;
      ELSIF p_force_status_novo THEN
        -- Reimportação SEM responsável no CSV → limpar vendedor_nome também
        UPDATE public.contatos SET vendedor_nome = NULL WHERE id = v_contato_id;
      END IF;

      IF p_prospeccao_id IS NOT NULL AND v_contato_id IS NOT NULL THEN
        v_already_exists := EXISTS (
          SELECT 1 FROM public.eventos_prospeccao
          WHERE contato_id = v_contato_id AND prospeccao_id = p_prospeccao_id
        );

        IF v_already_exists THEN
          v_already_linked := v_already_linked + 1;
        ELSE
          INSERT INTO public.eventos_prospeccao (contato_id, prospeccao_id)
          VALUES (v_contato_id, p_prospeccao_id);
          v_linked := v_linked + 1;
        END IF;

        IF NOT v_is_teste AND v_quarentena_enabled AND v_marca IS NOT NULL THEN
          PERFORM public.upsert_quarentena(
            v_telefone_raw,
            p_empresa_id,
            p_prospeccao_id,
            v_evento_nome,
            v_data_fim_evento,
            p_canal
          );
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      IF jsonb_array_length(v_error_details) < 200 THEN
        v_error_details := v_error_details || jsonb_build_object(
          'row', v_row_index,
          'telefone', v_telefone_raw,
          'nome', v_nome_raw,
          'erro', v_error_msg
        );
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'linked', v_linked,
    'already_linked', v_already_linked,
    'quarantined', v_quarantined,
    'global_blocked', v_global_blocked,
    'responsavel_applied', v_responsavel_applied,
    'responsavel_skipped', v_responsavel_skipped,
    'warning_details', v_warning_details,
    'errors', v_errors,
    'error_details', v_error_details,
    'total', jsonb_array_length(p_contatos)
  );
END;
$function$;


-- =========================================================================
-- PARTE 2: Relatórios dual-source (vivos + snapshot)
-- =========================================================================

-- get_resumo_stats
CREATE OR REPLACE FUNCTION public.get_resumo_stats(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid,
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH unioned AS (
    -- Eventos ativos: dados vivos
    SELECT c.status::text AS status, c.id AS contato_key
    FROM contatos c
    JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN prospeccoes p ON p.id = ep.prospeccao_id
    WHERE ep.prospeccao_id = ANY(p_prospeccao_ids)
      AND c.empresa_id = p_empresa_id
      AND p.snapshot_realizado = false
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)

    UNION ALL

    -- Eventos encerrados: snapshot
    SELECT s.status, s.contato_id AS contato_key
    FROM evento_snapshot_leads s
    JOIN prospeccoes p ON p.id = s.evento_id
    WHERE s.evento_id = ANY(p_prospeccao_ids)
      AND p.empresa_id = p_empresa_id
      AND p.snapshot_realizado = true
      AND (p_date_start IS NULL OR s.vinculado_em >= p_date_start)
      AND (p_date_end IS NULL OR s.vinculado_em <= p_date_end)
  )
  SELECT status, count(DISTINCT contato_key)::bigint AS count
  FROM unioned
  GROUP BY status;
$function$;


-- get_ranking_vendedores
CREATE OR REPLACE FUNCTION public.get_ranking_vendedores(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid,
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(user_id uuid, nome_completo text, convidados bigint, checkins bigint, vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH alive_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = false
  ),
  snap_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = true
  ),
  alive_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status::text AS status
    FROM contatos c
    JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN alive_events ae ON ae.id = ep.prospeccao_id
    WHERE c.empresa_id = p_empresa_id
      AND c.responsavel_email IS NOT NULL AND c.responsavel_email <> ''
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)
  ),
  team_members AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, au.email
    FROM prospeccao_equipes eq
    JOIN alive_events ae ON ae.id = eq.prospeccao_id
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    JOIN profiles p ON p.id = em.user_id
    JOIN auth.users au ON au.id = em.user_id
    WHERE eq.ativo = true AND p.tipo_acesso = 'Vendedor'
  ),
  extra_sellers AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, au.email
    FROM alive_contatos ec
    JOIN auth.users au ON au.email = ec.responsavel_email OR au.id::text = ec.responsavel_email
    JOIN profiles p ON p.id = au.id
    WHERE NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = au.id)
  ),
  alive_sellers AS (
    SELECT * FROM team_members UNION ALL SELECT * FROM extra_sellers
  ),
  alive_result AS (
    SELECT
      s.user_id,
      s.nome_completo,
      count(*) FILTER (WHERE ec.status IN ('Convidado','Confirmado','Check-in','Fechado','Venda'))::bigint AS convidados,
      count(*) FILTER (WHERE ec.status IN ('Check-in','Fechado','Venda'))::bigint AS checkins,
      count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas
    FROM alive_sellers s
    LEFT JOIN alive_contatos ec ON ec.responsavel_email = s.user_id::text OR ec.responsavel_email = s.email
    GROUP BY s.user_id, s.nome_completo
  ),
  snap_rows AS (
    SELECT sl.responsavel_email, sl.responsavel_nome, sl.status
    FROM evento_snapshot_leads sl
    JOIN snap_events se ON se.id = sl.evento_id
    WHERE sl.responsavel_email IS NOT NULL AND sl.responsavel_email <> ''
      AND (p_date_start IS NULL OR sl.vinculado_em >= p_date_start)
      AND (p_date_end IS NULL OR sl.vinculado_em <= p_date_end)
  ),
  snap_result AS (
    SELECT
      au.id AS user_id,
      COALESCE(MAX(pr.nome_completo), MAX(sr.responsavel_nome), MAX(au.email), MAX(sr.responsavel_email)) AS nome_completo,
      count(*) FILTER (WHERE sr.status IN ('Convidado','Confirmado','Check-in','Fechado','Venda'))::bigint AS convidados,
      count(*) FILTER (WHERE sr.status IN ('Check-in','Fechado','Venda'))::bigint AS checkins,
      count(*) FILTER (WHERE sr.status IN ('Fechado','Venda'))::bigint AS vendas
    FROM snap_rows sr
    LEFT JOIN auth.users au ON au.email = sr.responsavel_email OR au.id::text = sr.responsavel_email
    LEFT JOIN profiles pr ON pr.id = au.id
    GROUP BY au.id, sr.responsavel_email
  )
  SELECT
    user_id,
    nome_completo,
    sum(convidados)::bigint,
    sum(checkins)::bigint,
    sum(vendas)::bigint
  FROM (
    SELECT user_id, nome_completo, convidados, checkins, vendas FROM alive_result
    UNION ALL
    SELECT user_id, nome_completo, convidados, checkins, vendas FROM snap_result
  ) x
  GROUP BY user_id, nome_completo;
$function$;


-- get_desempenho_vendedores
CREATE OR REPLACE FUNCTION public.get_desempenho_vendedores(
  p_prospeccao_ids uuid[],
  p_empresa_id uuid,
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid, nome_completo text, tipo_acesso text,
  atribuidos bigint, convidados bigint, agendados bigint, confirmados bigint,
  checkins bigint, vendas bigint, descartes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH alive_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = false
  ),
  snap_events AS (
    SELECT id FROM prospeccoes
    WHERE id = ANY(p_prospeccao_ids) AND empresa_id = p_empresa_id AND snapshot_realizado = true
  ),
  alive_contatos AS (
    SELECT DISTINCT c.id, c.responsavel_email, c.status::text AS status
    FROM contatos c
    JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    JOIN alive_events ae ON ae.id = ep.prospeccao_id
    WHERE c.empresa_id = p_empresa_id
      AND c.responsavel_email IS NOT NULL AND c.responsavel_email <> ''
      AND (p_date_start IS NULL OR c.created_at >= p_date_start)
      AND (p_date_end IS NULL OR c.created_at <= p_date_end)
  ),
  team_members AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, p.tipo_acesso, au.email
    FROM prospeccao_equipes eq
    JOIN alive_events ae ON ae.id = eq.prospeccao_id
    JOIN prospeccao_equipe_membros em ON em.equipe_id = eq.id
    JOIN profiles p ON p.id = em.user_id
    JOIN auth.users au ON au.id = em.user_id
    WHERE eq.ativo = true AND p.tipo_acesso = 'Vendedor'
  ),
  extra_sellers AS (
    SELECT DISTINCT p.id AS user_id, p.nome_completo, p.tipo_acesso, au.email
    FROM alive_contatos ec
    JOIN auth.users au ON au.email = ec.responsavel_email OR au.id::text = ec.responsavel_email
    JOIN profiles p ON p.id = au.id
    WHERE NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = au.id)
  ),
  alive_sellers AS (
    SELECT * FROM team_members UNION ALL SELECT * FROM extra_sellers
  ),
  alive_result AS (
    SELECT
      s.user_id,
      s.nome_completo,
      s.tipo_acesso,
      count(ec.id)::bigint AS atribuidos,
      count(*) FILTER (WHERE ec.status = 'Convidado')::bigint AS convidados,
      count(*) FILTER (WHERE ec.status = 'Agendado')::bigint AS agendados,
      count(*) FILTER (WHERE ec.status = 'Confirmado')::bigint AS confirmados,
      count(*) FILTER (WHERE ec.status = 'Check-in')::bigint AS checkins,
      count(*) FILTER (WHERE ec.status IN ('Fechado','Venda'))::bigint AS vendas,
      count(*) FILTER (WHERE ec.status IN ('Descartado','Desperdício'))::bigint AS descartes
    FROM alive_sellers s
    LEFT JOIN alive_contatos ec ON ec.responsavel_email = s.user_id::text OR ec.responsavel_email = s.email
    GROUP BY s.user_id, s.nome_completo, s.tipo_acesso
  ),
  snap_rows AS (
    SELECT sl.contato_id, sl.responsavel_email, sl.responsavel_nome, sl.status
    FROM evento_snapshot_leads sl
    JOIN snap_events se ON se.id = sl.evento_id
    WHERE sl.responsavel_email IS NOT NULL AND sl.responsavel_email <> ''
      AND (p_date_start IS NULL OR sl.vinculado_em >= p_date_start)
      AND (p_date_end IS NULL OR sl.vinculado_em <= p_date_end)
  ),
  snap_result AS (
    SELECT
      au.id AS user_id,
      COALESCE(MAX(pr.nome_completo), MAX(sr.responsavel_nome), MAX(au.email), MAX(sr.responsavel_email)) AS nome_completo,
      MAX(pr.tipo_acesso) AS tipo_acesso,
      count(*)::bigint AS atribuidos,
      count(*) FILTER (WHERE sr.status = 'Convidado')::bigint AS convidados,
      count(*) FILTER (WHERE sr.status = 'Agendado')::bigint AS agendados,
      count(*) FILTER (WHERE sr.status = 'Confirmado')::bigint AS confirmados,
      count(*) FILTER (WHERE sr.status = 'Check-in')::bigint AS checkins,
      count(*) FILTER (WHERE sr.status IN ('Fechado','Venda'))::bigint AS vendas,
      count(*) FILTER (WHERE sr.status IN ('Descartado','Desperdício'))::bigint AS descartes
    FROM snap_rows sr
    LEFT JOIN auth.users au ON au.email = sr.responsavel_email OR au.id::text = sr.responsavel_email
    LEFT JOIN profiles pr ON pr.id = au.id
    GROUP BY au.id, sr.responsavel_email
  )
  SELECT
    user_id,
    nome_completo,
    tipo_acesso,
    sum(atribuidos)::bigint,
    sum(convidados)::bigint,
    sum(agendados)::bigint,
    sum(confirmados)::bigint,
    sum(checkins)::bigint,
    sum(vendas)::bigint,
    sum(descartes)::bigint
  FROM (
    SELECT * FROM alive_result
    UNION ALL
    SELECT * FROM snap_result
  ) x
  GROUP BY user_id, nome_completo, tipo_acesso;
$function$;