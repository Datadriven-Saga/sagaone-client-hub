
CREATE OR REPLACE FUNCTION public.tg_audit_prospeccoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_nome text;
  v_acao text;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_detalhes jsonb := '{}'::jsonb;
  v_changed boolean := false;
  v_template_zerado boolean := false;
  v_sensitive text[] := ARRAY[
    'template_prospeccao_id','template_agendado_id','template_nao_agendado_id',
    'template_agendado_48h_id','template_agendado_24h_id',
    'disparos_pausados','ativo','event_id_pri','canal',
    'data_inicio','data_fim','evento_confirmacao','snapshot_realizado'
  ];
  v_col text;
  v_old_val text;
  v_new_val text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY v_sensitive LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_col, v_col)
        INTO v_old_val, v_new_val USING OLD, NEW;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changed := true;
        v_old := v_old || jsonb_build_object(v_col, v_old_val);
        v_new := v_new || jsonb_build_object(v_col, v_new_val);
        IF v_col LIKE 'template_%_id' AND v_new_val IS NULL AND v_old_val IS NOT NULL THEN
          v_template_zerado := true;
        END IF;
      END IF;
    END LOOP;

    IF NOT v_changed THEN
      RETURN NEW;
    END IF;

    v_acao := CASE WHEN v_template_zerado THEN 'desassociacao_template' ELSE 'edicao_evento' END;
  ELSIF TG_OP = 'INSERT' THEN
    v_acao := 'criacao_evento';
    v_new := jsonb_build_object(
      'titulo', NEW.titulo, 'canal', NEW.canal,
      'template_prospeccao_id', NEW.template_prospeccao_id,
      'event_id_pri', NEW.event_id_pri, 'disparos_pausados', NEW.disparos_pausados
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'remocao_evento';
    v_old := to_jsonb(OLD);
  END IF;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT email, COALESCE(nome, email)
      INTO v_user_email, v_user_nome
      FROM public.profiles WHERE id = v_user_id;
  ELSE
    v_detalhes := v_detalhes || jsonb_build_object(
      'source', 'service_role_or_anon',
      'application_name', current_setting('application_name', true),
      'session_user', session_user::text,
      'current_user', current_user::text
    );
    BEGIN
      v_detalhes := v_detalhes || jsonb_build_object(
        'client_ip', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent',
        'function_caller', current_setting('request.headers', true)::jsonb->>'x-supabase-edge-function',
        'referer', current_setting('request.headers', true)::jsonb->>'referer'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.logs_prospeccoes (
    prospeccao_id, empresa_id, usuario_id, usuario_nome, usuario_email,
    acao, dados_anteriores, dados_novos, detalhes
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    v_user_id, v_user_nome, v_user_email,
    v_acao, v_old, v_new,
    CASE WHEN v_detalhes = '{}'::jsonb THEN NULL ELSE v_detalhes::text END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_audit_prospeccoes falhou: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_prospeccoes ON public.prospeccoes;
CREATE TRIGGER trg_audit_prospeccoes
  AFTER INSERT OR UPDATE OR DELETE ON public.prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_prospeccoes();

GRANT INSERT ON public.logs_prospeccoes TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.template_pausado_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  id_meta_recebido text,
  payload_bruto jsonb,
  client_ip text,
  user_agent text,
  status_final text,
  template_encontrado boolean,
  eventos_impactados_count int DEFAULT 0,
  erro text,
  duracao_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.template_pausado_audit TO authenticated;
GRANT ALL ON public.template_pausado_audit TO service_role;

ALTER TABLE public.template_pausado_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin TI Master podem visualizar template_pausado_audit" ON public.template_pausado_audit;
CREATE POLICY "Admin TI Master podem visualizar template_pausado_audit"
  ON public.template_pausado_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tipo_acesso IN ('Administrador'::tipo_acesso,'TI'::tipo_acesso,'Master'::tipo_acesso)
    )
  );

CREATE INDEX IF NOT EXISTS idx_tpa_created_at ON public.template_pausado_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpa_id_meta ON public.template_pausado_audit (id_meta_recebido);

INSERT INTO public.logs_prospeccoes (
  prospeccao_id, empresa_id, usuario_id, usuario_nome, usuario_email,
  acao, dados_anteriores, dados_novos, detalhes
)
SELECT
  p.id, p.empresa_id, NULL, 'sistema', NULL,
  'desassociacao_template_historico',
  jsonb_build_object('template_prospeccao_id', '(desconhecido)'),
  jsonb_build_object('template_prospeccao_id', NULL),
  '{"origem":"investigacao_manual_2026-06-22","motivo":"template_prospeccao_id encontrado NULL sem rastro de auditoria; trigger de auditoria criada nesta migration"}'
FROM public.prospeccoes p
WHERE p.id = '0dc6e182-aa2c-47b9-a744-6e0bfdbd42cb'
  AND NOT EXISTS (
    SELECT 1 FROM public.logs_prospeccoes lp
    WHERE lp.prospeccao_id = p.id AND lp.acao = 'desassociacao_template_historico'
  );
