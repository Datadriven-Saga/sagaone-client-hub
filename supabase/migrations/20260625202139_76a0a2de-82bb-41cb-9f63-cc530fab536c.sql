CREATE OR REPLACE FUNCTION public.tg_dispatch_movimentacao_lead_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url   text := 'https://karcxgnfiymlrkbzhewo.supabase.co';
  v_anon_key       text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcmN4Z25maXltbHJrYnpoZXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzI0NTEsImV4cCI6MjA3MjM0ODQ1MX0.POIqU4VIszatnejZm6cLMa8ndmhkFjHiOnpUo8xahS8';
  v_empresa_id     uuid;
  v_flag_enabled   boolean;
  v_request_id     bigint;
BEGIN
  -- Filtro grosso: só dispara para status finais elegíveis.
  IF NEW.status_novo IS NULL
     OR NEW.status_novo NOT IN ('Confirmado','Check-in','Descartado') THEN
    RETURN NEW;
  END IF;

  IF NEW.contato_id IS NULL OR NEW.prospeccao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver empresa_id a partir da prospecção (necessário para checar a flag).
  SELECT empresa_id INTO v_empresa_id
  FROM public.prospeccoes
  WHERE id = NEW.prospeccao_id;

  IF v_empresa_id IS NULL THEN
    RAISE LOG '[movimentacao-lead-trigger] prospeccao sem empresa_id: %', NEW.prospeccao_id;
    RETURN NEW;
  END IF;

  -- Curto-circuito por feature flag (evita custo de pg_net + edge invocation).
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
        'dados', jsonb_build_object(
          'contato_id',       NEW.contato_id,
          'empresa_id',       v_empresa_id,
          'prospeccao_id',    NEW.prospeccao_id,
          'status_anterior',  NEW.status_anterior,
          'status_novo',      NEW.status_novo,
          'usuario_id',       NEW.usuario_id,
          'log_id',           NEW.id,
          'origem',           'db_trigger'
        )
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
$$;