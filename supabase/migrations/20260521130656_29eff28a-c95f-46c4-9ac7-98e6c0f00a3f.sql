
-- ============= Lead creation: atomic RPC + phone check RPC =============

-- Normaliza telefone canônico (10 dígitos: DDD + 8) - mesma lógica usada nos imports.
CREATE OR REPLACE FUNCTION public.normalize_phone_canonical(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  v := regexp_replace(p_raw, '\D', '', 'g');
  IF v IS NULL OR length(v) = 0 THEN RETURN NULL; END IF;
  IF left(v,4) = '0055' THEN v := substring(v from 5); END IF;
  IF left(v,2) = '55' AND length(v) > 11 THEN v := substring(v from 3); END IF;
  IF left(v,1) = '0' AND (length(v) = 11 OR length(v) = 12) THEN v := substring(v from 2); END IF;
  IF length(v) = 11 AND substring(v from 3 for 1) = '9' THEN
    v := substring(v from 1 for 2) || substring(v from 4);
  END IF;
  RETURN v;
END;
$$;

-- Verifica se já existe contato pelo telefone na empresa (server-side, com normalização canônica)
CREATE OR REPLACE FUNCTION public.check_contato_by_telefone(
  p_empresa_id uuid,
  p_telefone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_contato record;
BEGIN
  v_tel := public.normalize_phone_canonical(p_telefone);
  IF v_tel IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT id, nome, telefone, email, responsavel_email, status, lead_id
    INTO v_contato
  FROM public.contatos
  WHERE empresa_id = p_empresa_id
    AND telefone = v_tel
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_contato.id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'telefone_normalizado', v_tel);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'telefone_normalizado', v_tel,
    'contato_id', v_contato.id,
    'lead_id', v_contato.lead_id,
    'nome', v_contato.nome,
    'telefone', v_contato.telefone,
    'email', v_contato.email,
    'status', v_contato.status,
    'responsavel_email', v_contato.responsavel_email
  );
END;
$$;

-- Cria lead + vínculo a evento de prospecção de forma atômica.
-- Toda validação de segurança (empresa, equipe) deve acontecer ANTES, na edge function.
CREATE OR REPLACE FUNCTION public.create_lead_atomic(
  p_empresa_id uuid,
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_responsavel_email text DEFAULT NULL,
  p_status text DEFAULT 'Atribuído',
  p_origem text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_prospeccao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contato_id uuid;
  v_lead_id integer;
  v_evento_id uuid;
BEGIN
  INSERT INTO public.contatos (
    empresa_id, nome, telefone, email,
    responsavel_email, status, origem, observacoes
  )
  VALUES (
    p_empresa_id,
    p_nome,
    p_telefone,
    p_email,
    p_responsavel_email,
    COALESCE(p_status, 'Atribuído')::status_lead,
    COALESCE(p_origem, 'Outros')::origem_lead,
    p_observacoes
  )
  RETURNING id, lead_id INTO v_contato_id, v_lead_id;

  IF p_prospeccao_id IS NOT NULL THEN
    INSERT INTO public.eventos_prospeccao (
      prospeccao_id, contato_id, tipo_evento, data_evento, descricao
    )
    VALUES (
      p_prospeccao_id,
      v_contato_id,
      'Contato Inicial'::tipo_evento_prospeccao,
      now(),
      'Lead cadastrado manualmente'
    )
    RETURNING id INTO v_evento_id;
  END IF;

  RETURN jsonb_build_object(
    'contato_id', v_contato_id,
    'lead_id', v_lead_id,
    'evento_prospeccao_id', v_evento_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_canonical(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.check_contato_by_telefone(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_lead_atomic(uuid, text, text, text, text, text, text, text, uuid) TO authenticated, service_role;
