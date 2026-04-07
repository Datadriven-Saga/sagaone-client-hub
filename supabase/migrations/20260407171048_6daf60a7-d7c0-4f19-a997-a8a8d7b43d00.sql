
-- 1. Normalize legacy canal values
UPDATE contato_quarentena SET canal = 'whatsapp' WHERE canal = 'Whatsapp';
UPDATE contato_quarentena SET canal = 'whatsapp' WHERE canal = 'Mensal';
UPDATE contato_quarentena SET canal = 'ligacao' WHERE canal = 'Ligação';
UPDATE contato_quarentena SET canal = 'whatsapp' WHERE canal IS NULL OR canal = '';

-- 2. Make canal NOT NULL with default
ALTER TABLE contato_quarentena ALTER COLUMN canal SET NOT NULL;
ALTER TABLE contato_quarentena ALTER COLUMN canal SET DEFAULT 'whatsapp';

-- 3. Drop old unique constraints/indexes and create new ones including canal
DROP INDEX IF EXISTS uq_quarentena_telefone_marca;
DROP INDEX IF EXISTS idx_quarentena_telefone_empresa;

CREATE UNIQUE INDEX uq_quarentena_telefone_marca_canal
  ON contato_quarentena (telefone_normalizado, marca, canal)
  WHERE marca IS NOT NULL;

CREATE UNIQUE INDEX idx_quarentena_telefone_empresa_canal
  ON contato_quarentena (telefone_normalizado, empresa_id, canal);

-- 4. Create quarentena_config table
CREATE TABLE IF NOT EXISTS quarentena_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  marca text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp', 'ligacao')),
  dias integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, marca, canal)
);

ALTER TABLE quarentena_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quarentena_config"
  ON quarentena_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/CRM can manage quarentena_config"
  ON quarentena_config FOR ALL TO authenticated
  USING (
    check_user_is_admin(auth.uid())
    OR empresa_id = get_user_active_company(auth.uid())
  )
  WITH CHECK (
    check_user_is_admin(auth.uid())
    OR empresa_id = get_user_active_company(auth.uid())
  );

-- 5. Helper function to get quarantine days
CREATE OR REPLACE FUNCTION public.get_quarentena_dias(p_empresa_id uuid, p_marca text, p_canal text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT dias FROM quarentena_config WHERE empresa_id = p_empresa_id AND marca = p_marca AND canal = p_canal),
    CASE WHEN p_canal = 'ligacao' THEN 30 ELSE 20 END
  );
$$;

-- 6. Update get_quarentena_paginated to use dynamic days
CREATE OR REPLACE FUNCTION public.get_quarentena_paginated(
  p_empresa_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_marcas text[] DEFAULT NULL,
  p_lojas uuid[] DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_sort_column text DEFAULT 'ultimo_impacto_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_canal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_ativos bigint;
  v_expirados bigint;
  v_desativados bigint;
  v_marcas jsonb;
  v_lojas jsonb;
BEGIN
  CREATE TEMP TABLE _q_filtered ON COMMIT DROP AS
  SELECT 
    cq.*,
    e.nome_empresa AS empresa_nome,
    public.get_quarentena_dias(cq.empresa_id, cq.marca, cq.canal) AS dias_config,
    CASE
      WHEN cq.desativado THEN 'desativado'
      WHEN cq.data_fim_evento IS NULL THEN 'ativo'
      WHEN now() < cq.data_fim_evento THEN 'ativo'
      WHEN now() > (cq.data_fim_evento + (public.get_quarentena_dias(cq.empresa_id, cq.marca, cq.canal) || ' days')::interval) THEN 'expirado'
      ELSE 'ativo'
    END AS computed_status
  FROM contato_quarentena cq
  LEFT JOIN empresas e ON e.id = cq.empresa_id
  WHERE
    (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id)
    AND (p_canal IS NULL OR cq.canal = p_canal)
    AND (p_search IS NULL OR p_search = '' OR
      cq.telefone_normalizado ILIKE '%' || p_search || '%' OR
      cq.evento_nome ILIKE '%' || p_search || '%' OR
      cq.marca ILIKE '%' || p_search || '%' OR
      e.nome_empresa ILIKE '%' || p_search || '%'
    )
    AND (p_marcas IS NULL OR array_length(p_marcas, 1) IS NULL OR cq.marca = ANY(p_marcas))
    AND (p_lojas IS NULL OR array_length(p_lojas, 1) IS NULL OR cq.empresa_id = ANY(p_lojas))
    AND (p_date_from IS NULL OR COALESCE(cq.data_fim_evento, cq.ultimo_impacto_at) >= p_date_from)
    AND (p_date_to IS NULL OR COALESCE(cq.data_fim_evento, cq.ultimo_impacto_at) <= p_date_to);

  IF p_status IS NOT NULL AND p_status != 'all' THEN
    DELETE FROM _q_filtered WHERE computed_status != p_status;
  END IF;

  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE computed_status = 'ativo'),
    COUNT(*) FILTER (WHERE computed_status = 'expirado'),
    COUNT(*) FILTER (WHERE computed_status = 'desativado')
  INTO v_total, v_ativos, v_expirados, v_desativados
  FROM _q_filtered;

  SELECT COALESCE(jsonb_agg(DISTINCT cq.marca ORDER BY cq.marca), '[]'::jsonb)
  INTO v_marcas
  FROM contato_quarentena cq
  WHERE cq.marca IS NOT NULL
    AND (p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sub.empresa_id, 'nome', sub.nome_empresa)), '[]'::jsonb)
  INTO v_lojas
  FROM (
    SELECT DISTINCT cq.empresa_id, e.nome_empresa
    FROM contato_quarentena cq
    JOIN empresas e ON e.id = cq.empresa_id
    WHERE p_empresa_id IS NULL OR cq.empresa_id = p_empresa_id
    ORDER BY e.nome_empresa
  ) sub;

  SELECT COALESCE(jsonb_agg(row_to_json(sub.*)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT 
      id, telefone_normalizado, marca, empresa_id, evento_nome,
      prospeccao_id, data_fim_evento, ultimo_impacto_at, canal,
      created_at, updated_at, desativado, desativado_por, desativado_em,
      empresa_nome, computed_status, dias_config
    FROM _q_filtered
    ORDER BY
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'asc' THEN telefone_normalizado END ASC,
      CASE WHEN p_sort_column = 'telefone_normalizado' AND p_sort_direction = 'desc' THEN telefone_normalizado END DESC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'asc' THEN COALESCE(marca, '') END ASC,
      CASE WHEN p_sort_column = 'marca' AND p_sort_direction = 'desc' THEN COALESCE(marca, '') END DESC,
      CASE WHEN p_sort_column = 'empresa_nome' AND p_sort_direction = 'asc' THEN COALESCE(empresa_nome, '') END ASC,
      CASE WHEN p_sort_column = 'empresa_nome' AND p_sort_direction = 'desc' THEN COALESCE(empresa_nome, '') END DESC,
      CASE WHEN p_sort_column = 'evento_nome' AND p_sort_direction = 'asc' THEN COALESCE(evento_nome, '') END ASC,
      CASE WHEN p_sort_column = 'evento_nome' AND p_sort_direction = 'desc' THEN COALESCE(evento_nome, '') END DESC,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'asc' THEN ultimo_impacto_at END ASC,
      CASE WHEN p_sort_column = 'ultimo_impacto_at' AND p_sort_direction = 'desc' THEN ultimo_impacto_at END DESC,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'asc' THEN COALESCE(data_fim_evento, '1970-01-01'::timestamptz) END ASC,
      CASE WHEN p_sort_column = 'data_fim_evento' AND p_sort_direction = 'desc' THEN COALESCE(data_fim_evento, '1970-01-01'::timestamptz) END DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  DROP TABLE IF EXISTS _q_filtered;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'ativos', v_ativos,
    'expirados', v_expirados,
    'desativados', v_desativados,
    'availableMarcas', v_marcas,
    'availableLojas', v_lojas
  );
END;
$function$;

-- 7. Update bulk_upsert_contatos to use canal-based quarantine
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(
  p_contatos jsonb,
  p_empresa_id uuid,
  p_prospeccao_id uuid DEFAULT NULL,
  p_canal text DEFAULT 'whatsapp'
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
  v_quarentena_dias int;
BEGIN
  v_quarentena_enabled := public.is_feature_enabled('quarentena_marca_ativa');
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_empresa_id;

  IF p_prospeccao_id IS NOT NULL THEN
    SELECT p.data_fim::timestamptz, p.titulo, COALESCE(p.is_teste, false)
    INTO v_data_fim_evento, v_evento_nome, v_is_teste
    FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;
  END IF;

  -- Get configured quarantine days for this empresa/marca/canal
  v_quarentena_dias := public.get_quarentena_dias(p_empresa_id, v_marca, p_canal);

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
      v_row_index := v_row_index + 1;
      v_telefone_raw := COALESCE(v_contato.value->>'telefone', '');
      v_nome_raw := COALESCE(v_contato.value->>'nome', '');

      v_is_global_blocked := public.check_global_opt_out(v_telefone_raw);
      IF v_is_global_blocked THEN
        v_global_blocked := v_global_blocked + 1;
        CONTINUE;
      END IF;

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
              AND now() < (cq.data_fim_evento + (v_quarentena_dias || ' days')::interval)
            THEN true
            ELSE false
          END
        INTO v_in_quarantine
        FROM (SELECT 1) dummy
        LEFT JOIN public.contato_quarentena cq 
          ON cq.telefone_normalizado = v_telefone_raw
          AND cq.marca = v_marca
          AND cq.canal = p_canal;
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

      IF v_marca IS NOT NULL AND v_contato_id IS NOT NULL AND NOT v_is_teste AND NOT v_is_excluded THEN
        INSERT INTO public.contato_quarentena (
          telefone_normalizado, empresa_id, marca, prospeccao_id,
          evento_nome, data_fim_evento, ultimo_impacto_at, canal
        ) VALUES (
          v_contato.value->>'telefone', p_empresa_id, v_marca, p_prospeccao_id,
          v_evento_nome, v_data_fim_evento, now(), p_canal
        )
        ON CONFLICT (telefone_normalizado, marca, canal) WHERE marca IS NOT NULL
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

-- 8. Update check_quarentena to support canal
CREATE OR REPLACE FUNCTION public.check_quarentena(
  p_telefones text[],
  p_loja_id uuid,
  p_canal text DEFAULT 'whatsapp'
)
RETURNS TABLE(telefone text, em_quarentena boolean, ultimo_impacto timestamptz, evento text, data_fim_evento timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  LEFT JOIN public.contato_quarentena cq 
    ON cq.telefone_normalizado = t.telefone 
    AND cq.marca = v_marca
    AND cq.canal = p_canal;
END;
$function$;

-- 9. Update upsert_quarentena to support canal
CREATE OR REPLACE FUNCTION public.upsert_quarentena(
  p_telefone text,
  p_loja_id uuid,
  p_prospeccao_id uuid,
  p_evento_nome text,
  p_data_fim_evento timestamptz,
  p_canal text DEFAULT 'whatsapp'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.quarentena_exclusoes WHERE telefone_normalizado = p_telefone) THEN
    RETURN;
  END IF;

  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;
  IF v_marca IS NULL THEN RETURN; END IF;

  INSERT INTO public.contato_quarentena (
    telefone_normalizado, empresa_id, marca, prospeccao_id, 
    evento_nome, data_fim_evento, ultimo_impacto_at, canal
  ) VALUES (
    p_telefone, p_loja_id, v_marca, p_prospeccao_id,
    p_evento_nome, p_data_fim_evento, now(), p_canal
  )
  ON CONFLICT (telefone_normalizado, marca, canal) WHERE marca IS NOT NULL
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    prospeccao_id = EXCLUDED.prospeccao_id,
    evento_nome = EXCLUDED.evento_nome,
    data_fim_evento = EXCLUDED.data_fim_evento,
    ultimo_impacto_at = now(),
    updated_at = now();
END;
$function$;
