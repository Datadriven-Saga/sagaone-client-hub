
-- Add global opt-out check to bulk_upsert_contatos
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(p_contatos jsonb, p_empresa_id uuid, p_prospeccao_id uuid DEFAULT NULL::uuid)
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
  v_error_msg text;
  v_telefone_raw text;
  v_nome_raw text;
  v_row_index int := 0;
  v_is_excluded boolean;
  v_is_global_blocked boolean;
BEGIN
  v_quarentena_enabled := public.is_feature_enabled('quarentena_marca_ativa');

  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_empresa_id;

  IF p_prospeccao_id IS NOT NULL THEN
    SELECT p.data_fim::timestamptz, p.titulo, COALESCE(p.is_teste, false)
    INTO v_data_fim_evento, v_evento_nome, v_is_teste
    FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;
  END IF;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
      v_row_index := v_row_index + 1;
      v_telefone_raw := COALESCE(v_contato.value->>'telefone', '');
      v_nome_raw := COALESCE(v_contato.value->>'nome', '');

      -- CHECK GLOBAL OPT-OUT FIRST (absolute block)
      v_is_global_blocked := public.check_global_opt_out(v_telefone_raw);
      IF v_is_global_blocked THEN
        v_global_blocked := v_global_blocked + 1;
        CONTINUE;
      END IF;
      
      -- Check if phone is in exclusion list
      v_is_excluded := EXISTS (
        SELECT 1 FROM public.quarentena_exclusoes
        WHERE telefone_normalizado = v_telefone_raw
      );

      v_in_quarantine := false;
      IF v_quarentena_enabled AND v_marca IS NOT NULL AND NOT v_is_teste AND NOT v_is_excluded THEN
        SELECT 
          CASE 
            WHEN cq.id IS NOT NULL 
              AND cq.desativado = false
              AND cq.data_fim_evento IS NOT NULL
              AND now() > cq.data_fim_evento 
              AND now() < (cq.data_fim_evento + INTERVAL '30 days')
            THEN true
            ELSE false
          END
        INTO v_in_quarantine
        FROM (SELECT 1) dummy
        LEFT JOIN public.contato_quarentena cq 
          ON cq.telefone_normalizado = v_telefone_raw
          AND cq.marca = v_marca;
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
        NULLIF(v_contato.value->>'responsavel_email', ''),
        NULLIF(v_contato.value->>'base_id', '')::uuid,
        NULLIF(v_contato.value->>'codigo_proposta', '')
      )
      ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
      DO UPDATE SET
        nome = CASE WHEN COALESCE(EXCLUDED.nome, '') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
        email = COALESCE(EXCLUDED.email, contatos.email),
        codigo_proposta = COALESCE(EXCLUDED.codigo_proposta, contatos.codigo_proposta),
        updated_at = now()
      RETURNING id, (xmax = 0) AS was_inserted
      INTO v_contato_id, v_is_new;

      IF v_is_new THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      IF p_prospeccao_id IS NOT NULL AND v_contato_id IS NOT NULL THEN
        INSERT INTO public.eventos_prospeccao (contato_id, prospeccao_id)
        VALUES (v_contato_id, p_prospeccao_id)
        ON CONFLICT (contato_id, prospeccao_id) DO NOTHING;

        IF FOUND THEN
          v_linked := v_linked + 1;
        ELSE
          v_already_linked := v_already_linked + 1;
        END IF;
      END IF;

      -- Skip quarantine insert for excluded phones
      IF v_marca IS NOT NULL AND v_contato_id IS NOT NULL AND NOT v_is_teste AND NOT v_is_excluded THEN
        INSERT INTO public.contato_quarentena (
          telefone_normalizado, empresa_id, marca, prospeccao_id,
          evento_nome, data_fim_evento, ultimo_impacto_at, canal
        ) VALUES (
          v_contato.value->>'telefone', p_empresa_id, v_marca, p_prospeccao_id,
          v_evento_nome, v_data_fim_evento, now(), 'whatsapp'
        )
        ON CONFLICT (telefone_normalizado, marca) WHERE marca IS NOT NULL
        DO UPDATE SET
          empresa_id = EXCLUDED.empresa_id,
          prospeccao_id = EXCLUDED.prospeccao_id,
          evento_nome = EXCLUDED.evento_nome,
          data_fim_evento = EXCLUDED.data_fim_evento,
          ultimo_impacto_at = now(),
          updated_at = now();
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_msg := SQLERRM;
      IF jsonb_array_length(v_error_details) < 100 THEN
        v_error_details := v_error_details || jsonb_build_object(
          'telefone', v_telefone_raw,
          'nome', v_nome_raw,
          'erro', v_error_msg,
          'index', v_row_index
        );
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'linked', v_linked,
    'already_linked', v_already_linked,
    'errors', v_errors,
    'quarantined', v_quarantined,
    'global_blocked', v_global_blocked,
    'error_details', v_error_details
  );
END;
$function$;
