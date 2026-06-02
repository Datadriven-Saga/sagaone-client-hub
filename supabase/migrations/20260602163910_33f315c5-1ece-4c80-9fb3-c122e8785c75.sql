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
  v_responsavel_skipped int := 0; -- mantido por compat; sempre 0 a partir desta versão
  v_rejected_responsavel int := 0;
  v_rejected_profile_inexistente int := 0;
  v_rejected_fora_da_equipe int := 0;
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
  v_vendedor_nome text;
  v_found_profile boolean;
  v_resp_user_id uuid;
  v_quarentena_interval interval;
  v_q_excluido_raw boolean;
  v_equipe_user_ids uuid[] := ARRAY[]::uuid[];
  v_has_team_validation boolean := false;
BEGIN
  v_quarentena_enabled := public.is_feature_enabled('quarentena_marca_ativa');
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_empresa_id;

  IF p_prospeccao_id IS NOT NULL THEN
    SELECT p.data_fim::timestamptz, p.titulo, COALESCE(p.is_teste, false)
    INTO v_data_fim_evento, v_evento_nome, v_is_teste
    FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;

    -- Set de membros ativos da equipe do evento (carregado uma vez)
    SELECT COALESCE(array_agg(pem.user_id), ARRAY[]::uuid[])
      INTO v_equipe_user_ids
      FROM public.prospeccao_equipe_membros pem
      JOIN public.prospeccao_equipes pe ON pe.id = pem.equipe_id
     WHERE pe.prospeccao_id = p_prospeccao_id
       AND pe.ativo = true;
    v_has_team_validation := true;
  END IF;

  v_quarentena_dias := public.get_quarentena_dias(p_empresa_id, v_marca, p_canal);
  v_quarentena_interval := (v_quarentena_dias || ' days')::interval;

  -- Lookup de identidade do responsável.
  -- Chave (lower(email)) -> { user_id, nome_completo }. Também aceita p.id::text e celular.
  -- IMPORTANTE: lookup NÃO filtra por profiles.empresa_id; elegibilidade vem da equipe do evento.
  CREATE TEMP TABLE _bulk_profiles_lookup (
    key text PRIMARY KEY,
    user_id uuid,
    nome_completo text
  ) ON COMMIT DROP;

  INSERT INTO _bulk_profiles_lookup (key, user_id, nome_completo)
  SELECT DISTINCT ON (key) key, user_id, nome_completo FROM (
    SELECT lower(au.email) AS key, p.id AS user_id, p.nome_completo
      FROM public.profiles p JOIN auth.users au ON au.id = p.id
     WHERE au.email IS NOT NULL AND au.email <> ''
    UNION ALL
    SELECT p.id::text AS key, p.id AS user_id, p.nome_completo
      FROM public.profiles p
    UNION ALL
    SELECT p.celular AS key, p.id AS user_id, p.nome_completo
      FROM public.profiles p
     WHERE p.celular IS NOT NULL AND p.celular <> ''
  ) s ORDER BY key;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
      v_row_index := v_row_index + 1;
      v_telefone_raw := COALESCE(v_contato.value->>'telefone', '');
      v_nome_raw := COALESCE(v_contato.value->>'nome', '');
      v_responsavel := NULLIF(lower(BTRIM(v_contato.value->>'responsavel_email')), '');
      v_phone_variants := public.phone_match_variants(v_telefone_raw);

      -- (A) global opt-out
      v_is_global_blocked := EXISTS (
        SELECT 1 FROM public.global_opt_outs
         WHERE telefone_normalizado = ANY (v_phone_variants)
      );
      IF v_is_global_blocked THEN
        v_global_blocked := v_global_blocked + 1;
        CONTINUE;
      END IF;

      -- (B) Decisão de responsável ANTES de qualquer escrita.
      v_resp_user_id := NULL;
      v_vendedor_nome := NULL;
      v_found_profile := false;

      IF v_responsavel IS NOT NULL THEN
        SELECT user_id, nome_completo
          INTO v_resp_user_id, v_vendedor_nome
          FROM _bulk_profiles_lookup
         WHERE key = v_responsavel
         LIMIT 1;
        v_found_profile := FOUND;

        IF NOT v_found_profile THEN
          v_rejected_responsavel := v_rejected_responsavel + 1;
          v_rejected_profile_inexistente := v_rejected_profile_inexistente + 1;
          IF jsonb_array_length(v_warning_details) < 200 THEN
            v_warning_details := v_warning_details || jsonb_build_object(
              'type', 'rejected',
              'reason', 'profile_inexistente',
              'value', v_responsavel,
              'telefone', v_telefone_raw,
              'nome', v_nome_raw
            );
          END IF;
          CONTINUE;
        END IF;

        IF v_has_team_validation
           AND NOT (v_resp_user_id = ANY (v_equipe_user_ids)) THEN
          v_rejected_responsavel := v_rejected_responsavel + 1;
          v_rejected_fora_da_equipe := v_rejected_fora_da_equipe + 1;
          IF jsonb_array_length(v_warning_details) < 200 THEN
            v_warning_details := v_warning_details || jsonb_build_object(
              'type', 'rejected',
              'reason', 'fora_da_equipe',
              'value', v_responsavel,
              'telefone', v_telefone_raw,
              'nome', v_nome_raw
            );
          END IF;
          -- limpa resolução para não influenciar o INSERT (não chega a executar, mas defensivo)
          v_vendedor_nome := NULL;
          v_found_profile := false;
          CONTINUE;
        END IF;
      END IF;

      v_is_excluded := EXISTS (
        SELECT 1 FROM public.quarentena_exclusoes
        WHERE telefone_normalizado = ANY (v_phone_variants)
      );

      -- (C) quarentena check
      v_in_quarantine := false;
      IF v_quarentena_enabled AND v_marca IS NOT NULL AND NOT v_is_teste AND NOT v_is_excluded THEN
        v_in_quarantine := EXISTS (
          SELECT 1 FROM public.contato_quarentena cq
           WHERE cq.telefone_normalizado = ANY (v_phone_variants)
             AND cq.marca = v_marca
             AND cq.canal = p_canal
             AND cq.desativado = false
             AND cq.data_fim_evento IS NOT NULL
             AND now() > cq.data_fim_evento
             AND now() < cq.data_fim_evento + v_quarentena_interval
        );
      END IF;

      IF v_in_quarantine THEN
        v_quarantined := v_quarantined + 1;
        CONTINUE;
      END IF;

      -- (D) INSERT consolidado: vendedor_nome e status já entram corretos.
      INSERT INTO public.contatos (
        nome, telefone, email, status, origem, empresa_id,
        observacoes, responsavel_email, base_id, codigo_proposta, vendedor_nome
      ) VALUES (
        COALESCE(v_contato.value->>'nome', ''),
        v_contato.value->>'telefone',
        NULLIF(v_contato.value->>'email', ''),
        CASE
          WHEN v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
          ELSE 'Novo'::status_lead
        END,
        COALESCE((v_contato.value->>'origem')::origem_lead, 'Outros'::origem_lead),
        p_empresa_id,
        NULLIF(v_contato.value->>'observacoes', ''),
        v_responsavel,
        NULLIF(v_contato.value->>'base_id', '')::uuid,
        NULLIF(v_contato.value->>'codigo_proposta', ''),
        v_vendedor_nome
      )
      ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
      DO UPDATE SET
        nome = CASE WHEN COALESCE(EXCLUDED.nome, '') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
        email = COALESCE(EXCLUDED.email, contatos.email),
        codigo_proposta = COALESCE(EXCLUDED.codigo_proposta, contatos.codigo_proposta),
        responsavel_email = CASE
          WHEN p_force_status_novo AND EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> '' THEN EXCLUDED.responsavel_email
          WHEN p_force_status_novo THEN NULL
          WHEN EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> '' THEN EXCLUDED.responsavel_email
          ELSE contatos.responsavel_email
        END,
        vendedor_nome = CASE
          WHEN p_force_status_novo AND v_vendedor_nome IS NOT NULL THEN v_vendedor_nome
          WHEN p_force_status_novo THEN NULL
          WHEN v_vendedor_nome IS NOT NULL THEN v_vendedor_nome
          ELSE contatos.vendedor_nome
        END,
        status = CASE
          WHEN p_force_status_novo AND v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
          WHEN p_force_status_novo THEN 'Novo'::status_lead
          WHEN v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
          ELSE contatos.status
        END,
        updated_at = now()
      RETURNING id, (xmax = 0) AS was_inserted
      INTO v_contato_id, v_is_new;

      IF v_is_new THEN v_inserted := v_inserted + 1; ELSE v_updated := v_updated + 1; END IF;

      IF v_found_profile THEN
        v_responsavel_applied := v_responsavel_applied + 1;
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
          v_q_excluido_raw := EXISTS (
            SELECT 1 FROM public.quarentena_exclusoes
             WHERE telefone_normalizado = v_telefone_raw
          );
          IF NOT v_q_excluido_raw THEN
            INSERT INTO public.contato_quarentena (
              telefone_normalizado, empresa_id, marca, prospeccao_id,
              evento_nome, data_fim_evento, ultimo_impacto_at, canal
            ) VALUES (
              v_telefone_raw, p_empresa_id, v_marca, p_prospeccao_id,
              v_evento_nome, v_data_fim_evento, now(), p_canal
            )
            ON CONFLICT (telefone_normalizado, marca, canal) WHERE marca IS NOT NULL
            DO UPDATE SET
              empresa_id = EXCLUDED.empresa_id,
              prospeccao_id = EXCLUDED.prospeccao_id,
              evento_nome = EXCLUDED.evento_nome,
              data_fim_evento = EXCLUDED.data_fim_evento,
              ultimo_impacto_at = now(),
              desativado = false,
              desativado_por = NULL,
              desativado_em = NULL,
              updated_at = now();
          END IF;
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
    'rejected_responsavel', v_rejected_responsavel,
    'rejected_reasons', jsonb_build_object(
      'profile_inexistente', v_rejected_profile_inexistente,
      'fora_da_equipe', v_rejected_fora_da_equipe
    ),
    'warning_details', v_warning_details,
    'errors', v_errors,
    'error_details', v_error_details,
    'total', jsonb_array_length(p_contatos)
  );
END;
$function$;