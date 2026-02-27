
-- 1) Remover vínculos de eventos_prospeccao dos contatos duplicados que serão removidos
-- Manter o contato com menor ID (mais antigo) e remover os duplicados
WITH duplicates AS (
  SELECT a.id AS dup_id
  FROM public.contatos a
  JOIN public.contatos b ON a.telefone = b.telefone 
    AND a.empresa_id = b.empresa_id
    AND a.id > b.id
  WHERE a.telefone IS NOT NULL AND a.telefone != ''
)
DELETE FROM public.eventos_prospeccao
WHERE contato_id IN (SELECT dup_id FROM duplicates);

-- 2) Agora remover contatos duplicados
DELETE FROM public.contatos a
USING public.contatos b
WHERE a.id > b.id
  AND a.telefone = b.telefone
  AND a.empresa_id = b.empresa_id
  AND a.telefone IS NOT NULL
  AND a.telefone != '';

-- 3) Criar índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_contatos_telefone_empresa_unique
ON public.contatos (telefone, empresa_id)
WHERE telefone IS NOT NULL AND telefone != '';

-- 4) RPC para upsert em massa de contatos (alta performance)
CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(
  p_contatos jsonb,
  p_empresa_id uuid,
  p_prospeccao_id uuid DEFAULT NULL
)
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
  v_contato record;
  v_contato_id uuid;
  v_is_new boolean;
BEGIN
  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    BEGIN
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

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'linked', v_linked,
    'already_linked', v_already_linked,
    'errors', v_errors
  );
END;
$$;
