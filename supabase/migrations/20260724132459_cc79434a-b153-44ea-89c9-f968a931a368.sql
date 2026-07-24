
-- Auditoria de restauração de status por lote
CREATE TABLE IF NOT EXISTS public.restauracao_status_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  loja_nome text,
  tipo_acesso_alvo text[] NOT NULL,
  executado_por uuid,
  executado_por_email text,
  batch_index int NOT NULL DEFAULT 0,
  processados int NOT NULL DEFAULT 0,
  atualizados int NOT NULL DEFAULT 0,
  status text NOT NULL, -- 'sucesso' | 'erro'
  erro_mensagem text,
  erro_codigo text,
  amostra jsonb,
  duracao_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.restauracao_status_auditoria TO authenticated;
GRANT ALL ON public.restauracao_status_auditoria TO service_role;

ALTER TABLE public.restauracao_status_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Master leem auditoria de restauracao"
ON public.restauracao_status_auditoria FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.tipo_acesso IN ('Administrador','Master')
      AND pr.is_active IS NOT FALSE)
);

CREATE POLICY "Admin/Master inserem auditoria de restauracao"
ON public.restauracao_status_auditoria FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.tipo_acesso IN ('Administrador','Master')
      AND pr.is_active IS NOT FALSE)
);

CREATE INDEX IF NOT EXISTS idx_restauracao_status_auditoria_empresa_created
  ON public.restauracao_status_auditoria (empresa_id, created_at DESC);

-- Preview por perfil (Vendedor / SDR / ambos)
CREATE OR REPLACE FUNCTION public.preview_restauracao_por_perfil(
  p_empresa_id uuid,
  p_tipo_acesso text[] DEFAULT ARRAY['Vendedor']
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60000'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_result jsonb;
  v_tipos text[] := COALESCE(p_tipo_acesso, ARRAY['Vendedor']);
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa obrigatoria' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid
      AND pr.tipo_acesso IN ('Administrador','Master')
      AND pr.is_active IS NOT FALSE
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH eventos AS (
    SELECT p.id FROM public.prospeccoes p
    WHERE p.empresa_id = p_empresa_id
      AND p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
  ),
  ultimo_log AS (
    SELECT DISTINCT ON (l.prospeccao_id, l.contato_id)
      l.contato_id, l.prospeccao_id, l.usuario_id,
      public.normalize_lead_status_label(l.status_novo) AS status_esperado,
      NULLIF(btrim(l.vendedor_atendimento_email), '') AS log_email
    FROM public.logs_movimentacao_contatos l
    JOIN eventos e ON e.id = l.prospeccao_id
    WHERE l.contato_id IS NOT NULL
      AND l.status_novo IS NOT NULL
      AND COALESCE(l.observacoes,'') NOT ILIKE 'auto-trigger%'
      AND COALESCE(l.observacoes,'') NOT ILIKE '%fallback de migracao%'
    ORDER BY l.prospeccao_id, l.contato_id, l.data_movimentacao DESC, l.created_at DESC
  ),
  divergentes AS (
    SELECT c.id AS contato_id, c.nome, c.status::text AS status_atual,
           u.status_esperado, u.usuario_id, u.log_email,
           au.email AS auth_email, pr.tipo_acesso, pr.nome_completo
    FROM ultimo_log u
    JOIN public.contatos c ON c.id = u.contato_id
    LEFT JOIN public.profiles pr ON pr.id = u.usuario_id
    LEFT JOIN auth.users au ON au.id = u.usuario_id
    WHERE public.normalize_lead_status_label(c.status::text) IS DISTINCT FROM u.status_esperado
      AND u.status_esperado IN ('Atribuído','Em Espera','Em Atendimento','Convidado','Confirmado','Compareceu','Não Compareceu','Venda','Sem Interesse','Sem Contato','Insucesso')
  )
  SELECT jsonb_build_object(
    'empresa_id', p_empresa_id,
    'tipo_acesso_alvo', v_tipos,
    'total_divergentes', (SELECT COUNT(*) FROM divergentes),
    'elegiveis', (SELECT COUNT(*) FROM divergentes
                    WHERE tipo_acesso = ANY(v_tipos)
                      AND COALESCE(log_email, auth_email) IS NOT NULL),
    'elegiveis_vendedor', (SELECT COUNT(*) FROM divergentes
                             WHERE tipo_acesso = 'Vendedor'
                               AND COALESCE(log_email, auth_email) IS NOT NULL),
    'elegiveis_sdr', (SELECT COUNT(*) FROM divergentes
                        WHERE tipo_acesso = 'SDR'
                          AND COALESCE(log_email, auth_email) IS NOT NULL),
    'descartados_outros_perfis', (SELECT COUNT(*) FROM divergentes
                                    WHERE tipo_acesso IS NOT NULL
                                      AND NOT (tipo_acesso = ANY(v_tipos))),
    'descartados_sem_perfil', (SELECT COUNT(*) FROM divergentes WHERE tipo_acesso IS NULL),
    'amostra', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'contato_id', contato_id, 'nome', nome,
        'status_atual', status_atual, 'status_esperado', status_esperado,
        'responsavel_email', COALESCE(log_email, auth_email),
        'vendedor_nome', nome_completo, 'tipo_acesso', tipo_acesso
      )) FROM (
        SELECT * FROM divergentes
        WHERE tipo_acesso = ANY(v_tipos)
          AND COALESCE(log_email, auth_email) IS NOT NULL
        LIMIT 20
      ) s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_restauracao_por_perfil(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_restauracao_por_perfil(uuid, text[]) TO authenticated;

-- Execução por perfil
CREATE OR REPLACE FUNCTION public.restore_leads_por_perfil(
  p_empresa_id uuid,
  p_tipo_acesso text[] DEFAULT ARRAY['Vendedor'],
  p_dry_run boolean DEFAULT true,
  p_limit int DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60000'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_limit int := LEAST(500, GREATEST(1, COALESCE(p_limit, 500)));
  v_atualizados int := 0;
  v_amostra jsonb;
  v_tipos text[] := COALESCE(p_tipo_acesso, ARRAY['Vendedor']);
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa obrigatoria' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid
      AND pr.tipo_acesso IN ('Administrador','Master')
      AND pr.is_active IS NOT FALSE
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _restore_alvos (
    contato_id uuid,
    prospeccao_id uuid,
    status_atual text,
    status_novo text,
    responsavel_email_antigo text,
    responsavel_email_novo text,
    vendedor_nome_novo text,
    tipo_acesso_log text
  ) ON COMMIT DROP;

  TRUNCATE _restore_alvos;

  INSERT INTO _restore_alvos
  WITH eventos AS (
    SELECT p.id FROM public.prospeccoes p
    WHERE p.empresa_id = p_empresa_id
      AND p.empresa_id <> 'b32ae8c9-34f6-4646-946e-2a05ff07b02b'::uuid
  ),
  ultimo_log AS (
    SELECT DISTINCT ON (l.prospeccao_id, l.contato_id)
      l.contato_id, l.prospeccao_id, l.usuario_id,
      public.normalize_lead_status_label(l.status_novo) AS status_esperado,
      NULLIF(btrim(l.vendedor_atendimento_email), '') AS log_email
    FROM public.logs_movimentacao_contatos l
    JOIN eventos e ON e.id = l.prospeccao_id
    WHERE l.contato_id IS NOT NULL
      AND l.status_novo IS NOT NULL
      AND COALESCE(l.observacoes,'') NOT ILIKE 'auto-trigger%'
      AND COALESCE(l.observacoes,'') NOT ILIKE '%fallback de migracao%'
    ORDER BY l.prospeccao_id, l.contato_id, l.data_movimentacao DESC, l.created_at DESC
  )
  SELECT c.id, u.prospeccao_id,
         c.status::text,
         u.status_esperado,
         c.responsavel_email,
         COALESCE(u.log_email, au.email),
         COALESCE(pr.nome_completo, c.vendedor_nome),
         pr.tipo_acesso
  FROM ultimo_log u
  JOIN public.contatos c ON c.id = u.contato_id
  JOIN public.profiles pr ON pr.id = u.usuario_id AND pr.tipo_acesso = ANY(v_tipos)
  LEFT JOIN auth.users au ON au.id = u.usuario_id
  WHERE public.normalize_lead_status_label(c.status::text) IS DISTINCT FROM u.status_esperado
    AND u.status_esperado IN ('Atribuído','Em Espera','Em Atendimento','Convidado','Confirmado','Compareceu','Não Compareceu','Venda','Sem Interesse','Sem Contato','Insucesso')
    AND COALESCE(u.log_email, au.email) IS NOT NULL
  LIMIT v_limit;

  SELECT jsonb_agg(to_jsonb(a.*)) INTO v_amostra FROM (SELECT * FROM _restore_alvos LIMIT 20) a;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'empresa_id', p_empresa_id,
      'tipo_acesso_alvo', v_tipos,
      'elegiveis', (SELECT COUNT(*) FROM _restore_alvos),
      'amostra', COALESCE(v_amostra, '[]'::jsonb)
    );
  END IF;

  WITH upd AS (
    UPDATE public.contatos c
    SET status = a.status_novo::status_lead,
        responsavel_email = a.responsavel_email_novo,
        vendedor_nome = COALESCE(a.vendedor_nome_novo, c.vendedor_nome),
        updated_at = now()
    FROM _restore_alvos a
    WHERE c.id = a.contato_id
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_atualizados FROM upd;

  INSERT INTO public.logs_movimentacao_contatos
    (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes, data_movimentacao)
  SELECT a.contato_id, a.prospeccao_id, a.status_atual, a.status_novo, v_uid,
         'restauracao_perfil_v1 [' || array_to_string(v_tipos,',') || '] | responsavel:' || COALESCE(a.responsavel_email_novo,''),
         now()
  FROM _restore_alvos a;

  RETURN jsonb_build_object(
    'dry_run', false,
    'empresa_id', p_empresa_id,
    'tipo_acesso_alvo', v_tipos,
    'processados', (SELECT COUNT(*) FROM _restore_alvos),
    'atualizados', v_atualizados,
    'amostra', COALESCE(v_amostra, '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_leads_por_perfil(uuid, text[], boolean, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_leads_por_perfil(uuid, text[], boolean, int) TO authenticated;
