-- ============================================================
-- 1) Helpers IMMUTABLE para normalização e match de telefone BR
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_phone_br(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_digits text;
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(phone, '\D', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  -- Remove DDI 55 quando vem com 12 (fixo) ou 13 (celular) dígitos
  IF length(v_digits) IN (12, 13) AND left(v_digits, 2) = '55' THEN
    v_digits := substring(v_digits from 3);
  END IF;

  -- Remove 9º dígito de celular (11 -> 10) quando o 3º dígito é '9'
  IF length(v_digits) = 11 AND substring(v_digits, 3, 1) = '9' THEN
    v_digits := substring(v_digits, 1, 2) || substring(v_digits from 4);
  END IF;

  RETURN v_digits;
END;
$$;

COMMENT ON FUNCTION public.normalize_phone_br(text) IS
  'Retorna o telefone BR no formato canônico do projeto: 10 dígitos (DDD + 8), sem DDI 55, sem 9º dígito de celular. IMMUTABLE.';


CREATE OR REPLACE FUNCTION public.phone_match_variants(phone text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_canon text;
  v_raw   text;
  v_with9 text;
BEGIN
  IF phone IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  v_raw   := regexp_replace(phone, '\D', '', 'g');
  v_canon := public.normalize_phone_br(phone);

  -- Quando o canônico tem 10 dígitos (DDD + 8), gera também a versão com 9
  IF v_canon IS NOT NULL AND length(v_canon) = 10 THEN
    v_with9 := substring(v_canon, 1, 2) || '9' || substring(v_canon from 3);
    RETURN ARRAY[v_canon, v_with9, v_raw];
  END IF;

  -- Fallback: devolve o que conseguir, sem duplicar
  IF v_canon IS NOT NULL THEN
    RETURN ARRAY[v_canon, v_raw];
  END IF;
  RETURN ARRAY[v_raw];
END;
$$;

COMMENT ON FUNCTION public.phone_match_variants(text) IS
  'Retorna as variantes do mesmo telefone (10 e 11 dígitos) para uso em queries de match (quarentena, opt-out, exclusões).';


-- ============================================================
-- 2) check_global_opt_out: aceita as duas variantes
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_global_opt_out(p_telefone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.global_opt_outs
    WHERE telefone_normalizado = ANY (public.phone_match_variants(p_telefone))
  );
$$;


-- ============================================================
-- 3) check_global_opt_out_bulk: aceita as duas variantes
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_global_opt_out_bulk(p_telefones text[])
RETURNS TABLE(telefone text, bloqueado boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.telefone,
    EXISTS (
      SELECT 1 FROM public.global_opt_outs g
      WHERE g.telefone_normalizado = ANY (public.phone_match_variants(t.telefone))
    ) AS bloqueado
  FROM unnest(p_telefones) AS t(telefone);
$$;


-- ============================================================
-- 4) check_quarentena: JOIN aceita as duas variantes
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_quarentena(p_telefones text[], p_loja_id uuid, p_canal text DEFAULT 'whatsapp'::text)
RETURNS TABLE(telefone text, em_quarentena boolean, ultimo_impacto timestamp with time zone, evento text, data_fim_evento timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_marca text;
  v_dias int;
BEGIN
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;

  IF v_marca IS NULL THEN
    RETURN QUERY
    SELECT t.telefone, false, NULL::timestamptz, NULL::text, NULL::timestamptz
    FROM unnest(p_telefones) AS t(telefone);
    RETURN;
  END IF;

  v_dias := public.get_quarentena_dias(p_loja_id, v_marca, p_canal);

  RETURN QUERY
  SELECT
    t.telefone,
    CASE
      WHEN cq.id IS NOT NULL
        AND cq.desativado = false
        AND cq.data_fim_evento IS NOT NULL
        AND now() > cq.data_fim_evento
        AND now() < (cq.data_fim_evento + (v_dias || ' days')::interval)
      THEN true
      ELSE false
    END AS em_quarentena,
    cq.ultimo_impacto_at AS ultimo_impacto,
    cq.evento_nome AS evento,
    cq.data_fim_evento
  FROM unnest(p_telefones) AS t(telefone)
  LEFT JOIN LATERAL (
    SELECT cq2.*
    FROM public.contato_quarentena cq2
    WHERE cq2.telefone_normalizado = ANY (public.phone_match_variants(t.telefone))
      AND cq2.marca = v_marca
      AND cq2.canal = p_canal
    ORDER BY cq2.desativado ASC, cq2.data_fim_evento DESC NULLS LAST
    LIMIT 1
  ) cq ON true;
END;
$$;


-- ============================================================
-- 5) bulk_upsert_contatos: match de exclusões e quarentena
--    aceita as duas variantes. Escrita permanece com v_telefone_raw.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(p_contatos jsonb, p_empresa_id uuid, p_prospeccao_id uuid DEFAULT NULL::uuid, p_canal text DEFAULT 'whatsapp'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_phone_variants text[];
  v_nome_raw text;
  v_row_index int := 0;
  v_is_excluded boolean;
  v_is_global_blocked boolean;
  v_quarentena_dias int;
  v_already_exists boolean;
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
    'errors', v_errors,
    'error_details', v_error_details,
    'total', jsonb_array_length(p_contatos)
  );
END;
$$;