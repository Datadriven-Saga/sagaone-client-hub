
-- 1. Add columns
ALTER TABLE public.contato_quarentena 
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS data_fim_evento timestamptz;

-- 2. Backfill marca from empresas
UPDATE public.contato_quarentena cq
SET marca = e.marca
FROM public.empresas e
WHERE cq.empresa_id = e.id AND cq.marca IS NULL;

-- 3. Deduplicate: keep most recent per (telefone_normalizado, marca)
DELETE FROM public.contato_quarentena
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY telefone_normalizado, marca 
        ORDER BY ultimo_impacto_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM public.contato_quarentena
    WHERE marca IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 4. Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_quarentena_telefone_marca 
  ON public.contato_quarentena (telefone_normalizado, marca) 
  WHERE marca IS NOT NULL;

-- 5. DROP old check_quarentena (return type changed)
DROP FUNCTION IF EXISTS public.check_quarentena(text[], uuid);

-- 6. Rewrite check_quarentena RPC
CREATE FUNCTION public.check_quarentena(p_telefones text[], p_loja_id uuid)
RETURNS TABLE(telefone text, em_quarentena boolean, ultimo_impacto timestamp with time zone, evento text, data_fim_evento timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_marca text;
BEGIN
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;

  IF v_marca IS NULL THEN
    RETURN QUERY
    SELECT t.telefone, false, NULL::timestamptz, NULL::text, NULL::timestamptz
    FROM unnest(p_telefones) AS t(telefone);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.telefone,
    CASE 
      WHEN cq.id IS NOT NULL 
        AND cq.data_fim_evento IS NOT NULL
        AND now() > cq.data_fim_evento 
        AND now() < (cq.data_fim_evento + INTERVAL '30 days')
      THEN true
      ELSE false
    END AS em_quarentena,
    cq.ultimo_impacto_at AS ultimo_impacto,
    cq.evento_nome AS evento,
    cq.data_fim_evento
  FROM unnest(p_telefones) AS t(telefone)
  LEFT JOIN public.contato_quarentena cq 
    ON cq.telefone_normalizado = t.telefone 
    AND cq.marca = v_marca;
END;
$func$;

-- 7. Create upsert_quarentena function
CREATE OR REPLACE FUNCTION public.upsert_quarentena(
  p_telefone text,
  p_loja_id uuid,
  p_prospeccao_id uuid,
  p_evento_nome text,
  p_data_fim_evento timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_marca text;
BEGIN
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_loja_id;
  IF v_marca IS NULL THEN RETURN; END IF;

  INSERT INTO public.contato_quarentena (
    telefone_normalizado, empresa_id, marca, prospeccao_id, 
    evento_nome, data_fim_evento, ultimo_impacto_at, canal
  ) VALUES (
    p_telefone, p_loja_id, v_marca, p_prospeccao_id,
    p_evento_nome, p_data_fim_evento, now(), 'whatsapp'
  )
  ON CONFLICT (telefone_normalizado, marca) WHERE marca IS NOT NULL
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    prospeccao_id = EXCLUDED.prospeccao_id,
    evento_nome = EXCLUDED.evento_nome,
    data_fim_evento = EXCLUDED.data_fim_evento,
    ultimo_impacto_at = now(),
    updated_at = now();
END;
$func$;

-- 8. Update bulk_upsert_contatos with quarantine logic
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(
  p_contatos jsonb, 
  p_empresa_id uuid, 
  p_prospeccao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_linked int := 0;
  v_already_linked int := 0;
  v_errors int := 0;
  v_quarantined int := 0;
  v_contato record;
  v_contato_id uuid;
  v_is_new boolean;
  v_marca text;
  v_data_fim_evento timestamptz;
  v_evento_nome text;
  v_in_quarantine boolean;
BEGIN
  SELECT e.marca INTO v_marca FROM public.empresas e WHERE e.id = p_empresa_id;

  IF p_prospeccao_id IS NOT NULL THEN
    SELECT p.data_fim::timestamptz, p.titulo
    INTO v_data_fim_evento, v_evento_nome
    FROM public.prospeccoes p WHERE p.id = p_prospeccao_id;
  END IF;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
      v_in_quarantine := false;
      IF v_marca IS NOT NULL THEN
        SELECT 
          CASE 
            WHEN cq.id IS NOT NULL 
              AND cq.data_fim_evento IS NOT NULL
              AND now() > cq.data_fim_evento 
              AND now() < (cq.data_fim_evento + INTERVAL '30 days')
            THEN true
            ELSE false
          END
        INTO v_in_quarantine
        FROM (SELECT 1) dummy
        LEFT JOIN public.contato_quarentena cq 
          ON cq.telefone_normalizado = (v_contato.value->>'telefone')
          AND cq.marca = v_marca;
      END IF;

      IF v_in_quarantine THEN
        v_quarantined := v_quarantined + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.contatos (
        nome, telefone, email, status, origem, empresa_id,
        observacoes, responsavel_email, base_id
      ) VALUES (
        COALESCE(v_contato.value->>'nome', ''),
        v_contato.value->>'telefone',
        NULLIF(v_contato.value->>'email', ''),
        'Novo'::status_lead,
        COALESCE((v_contato.value->>'origem')::origem_lead, 'Outros'::origem_lead),
        p_empresa_id,
        NULLIF(v_contato.value->>'observacoes', ''),
        NULLIF(v_contato.value->>'responsavel_email', ''),
        NULLIF(v_contato.value->>'base_id', '')::uuid
      )
      ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
      DO UPDATE SET
        nome = CASE WHEN COALESCE(EXCLUDED.nome, '') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
        email = COALESCE(EXCLUDED.email, contatos.email),
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

      IF v_marca IS NOT NULL AND v_contato_id IS NOT NULL THEN
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
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'linked', v_linked,
    'already_linked', v_already_linked,
    'errors', v_errors,
    'quarantined', v_quarantined
  );
END;
$func$;
