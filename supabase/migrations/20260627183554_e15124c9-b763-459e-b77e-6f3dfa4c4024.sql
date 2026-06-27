
ALTER TABLE public.logs_movimentacao_contatos
  ADD COLUMN IF NOT EXISTS vendedor_atendimento_nome  text,
  ADD COLUMN IF NOT EXISTS vendedor_atendimento_email text;

CREATE OR REPLACE FUNCTION public.tg_dispatch_movimentacao_lead_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url   text := 'https://karcxgnfiymlrkbzhewo.supabase.co';
  v_anon_key       text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcmN4Z25maXltbHJrYnpoZXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzI0NTEsImV4cCI6MjA3MjM0ODQ1MX0.POIqU4VIszatnejZm6cLMa8ndmhkFjHiOnpUo8xahS8';
  v_empresa_id     uuid;
  v_flag_enabled   boolean;
  v_email_vendedor text;
  v_request_id     bigint;
  v_dados          jsonb;
BEGIN
  IF NEW.status_novo IS NULL
     OR NEW.status_novo NOT IN ('Confirmado','Check-in','Descartado') THEN
    RETURN NEW;
  END IF;

  IF NEW.contato_id IS NULL OR NEW.prospeccao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.prospeccoes
  WHERE id = NEW.prospeccao_id;

  IF v_empresa_id IS NULL THEN
    RAISE LOG '[movimentacao-lead-trigger] prospeccao sem empresa_id: %', NEW.prospeccao_id;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT public.is_feature_enabled_for_empresa(
      'webhook_movimentacao_lead'::text,
      v_empresa_id
    ) INTO v_flag_enabled;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[movimentacao-lead-trigger] erro flag empresa=%: % %', v_empresa_id, SQLSTATE, SQLERRM;
    v_flag_enabled := false;
  END;

  IF v_flag_enabled IS NOT TRUE THEN
    RAISE LOG '[movimentacao-lead-trigger] skip flag_disabled empresa=%', v_empresa_id;
    RETURN NEW;
  END IF;

  IF NEW.usuario_id IS NULL THEN
    SELECT responsavel_email INTO v_email_vendedor
    FROM public.contatos
    WHERE id = NEW.contato_id;
  END IF;

  v_dados := jsonb_build_object(
    'contato_id',       NEW.contato_id,
    'empresa_id',       v_empresa_id,
    'prospeccao_id',    NEW.prospeccao_id,
    'status_anterior',  NEW.status_anterior,
    'status_novo',      NEW.status_novo,
    'usuario_id',       NEW.usuario_id,
    'email_vendedor',   v_email_vendedor,
    'log_id',           NEW.id,
    'origem',           'db_trigger'
  );

  IF NEW.vendedor_atendimento_nome IS NOT NULL
     AND length(btrim(NEW.vendedor_atendimento_nome)) > 0 THEN
    v_dados := v_dados
      || jsonb_build_object('vendedor_atendimento_nome', NEW.vendedor_atendimento_nome)
      || jsonb_build_object('vendedor_atendimento_email', COALESCE(NEW.vendedor_atendimento_email, ''));
  END IF;

  BEGIN
    SELECT net.http_post(
      url     := v_supabase_url || '/functions/v1/trigger-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
      body    := jsonb_build_object(
        'gatilho', 'movimentacao_lead_kanban',
        'dados',   v_dados
      ),
      timeout_milliseconds := 5000
    ) INTO v_request_id;

    RAISE LOG '[movimentacao-lead-trigger] dispatched contato=% prospeccao=% status=% net_request=%',
      NEW.contato_id, NEW.prospeccao_id, NEW.status_novo, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[movimentacao-lead-trigger] pg_net falhou: % %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_vendedores_atendimento(p_empresa_id uuid)
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.nome_completo AS nome,
    COALESCE(au.email::text, '') AS email
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.empresa_id = p_empresa_id
    AND p.tipo_acesso::text = 'Vendedor'
    AND COALESCE(p.is_active, true) = true
    AND public.user_can_access_empresa(p_empresa_id, auth.uid())
  ORDER BY p.nome_completo NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendedores_atendimento(uuid) TO authenticated;
