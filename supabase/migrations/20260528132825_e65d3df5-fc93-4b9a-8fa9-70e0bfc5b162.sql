
-- ============================================================
-- Parte 3: Lock atômico para self-chain do process-import
-- ============================================================
ALTER TABLE public.import_logs
  ADD COLUMN IF NOT EXISTS chain_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_import_logs_status_heartbeat
  ON public.import_logs(status, last_heartbeat_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_import_processing(
  p_import_id uuid,
  p_worker_id text,
  p_max_chains integer DEFAULT 20
)
RETURNS public.import_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.import_logs;
BEGIN
  UPDATE public.import_logs
  SET
    chain_count       = chain_count + 1,
    locked_until      = now() + interval '130 seconds',
    worker_id         = p_worker_id,
    last_heartbeat_at = now(),
    status            = 'processing',
    updated_at        = now()
  WHERE id = p_import_id
    AND status IN ('pending', 'processing')
    AND chain_count < p_max_chains
    AND (
      locked_until IS NULL
      OR locked_until < now()
      OR worker_id = p_worker_id
    )
  RETURNING * INTO v_log;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import % is locked, finished, failed or exceeded max chains', p_import_id
      USING ERRCODE = 'lock_not_available';
  END IF;

  RETURN v_log;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_import_processing(
  p_import_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.import_logs
  SET
    locked_until      = now() + interval '130 seconds',
    last_heartbeat_at = now(),
    updated_at        = now()
  WHERE id = p_import_id
    AND status = 'processing'
    AND worker_id = p_worker_id;

  RETURN FOUND;
END;
$$;

-- ============================================================
-- Parte 4: Watchdog
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_stale_imports_as_error()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.import_logs
  SET
    status     = 'error',
    message    = COALESCE(NULLIF(message, '') || E'\n', '') ||
                 'Import marcado como erro automaticamente por watchdog: sem heartbeat recente.',
    updated_at = now()
  WHERE status = 'processing'
    AND COALESCE(last_heartbeat_at, updated_at, created_at) < now() - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Agendar a cada 5 minutos se pg_cron estiver disponível (best-effort, idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('watchdog-import-logs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchdog-import-logs');
    PERFORM cron.schedule(
      'watchdog-import-logs',
      '*/5 * * * *',
      $cron$SELECT public.mark_stale_imports_as_error();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron pode não estar disponível; ignorar silenciosamente
  NULL;
END;
$$;

-- ============================================================
-- Parte 5: Bulk update lead_ids
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_lead_ids(
  p_items jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH payload AS (
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      id_evento     integer,
      telefone_lead text,
      lead_id       text
    )
  )
  UPDATE public.prospect_pri_voz p
  SET
    lead_id        = payload.lead_id,
    atualizado_em  = now()
  FROM payload
  WHERE p.id_evento     = payload.id_evento
    AND p.telefone_lead = payload.telefone_lead
    AND p.lead_id IS DISTINCT FROM payload.lead_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- Parte 6: Bulk lookup/update telefones legados
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_contatos_by_telefones(
  p_empresa_id uuid,
  p_telefones  text[]
)
RETURNS TABLE (
  id       uuid,
  telefone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.telefone
  FROM public.contatos c
  WHERE c.empresa_id = p_empresa_id
    AND c.telefone = ANY(p_telefones);
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_telefones_contatos(
  p_empresa_id uuid,
  p_items      jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Bloqueia conflito de unique (telefone, empresa_id):
  -- se já existir contato com o telefone_novo, não atualiza o legado
  -- (o caller deve mesclar antes nesse caso).
  WITH payload AS (
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      contato_id    uuid,
      telefone_novo text
    )
  ),
  safe AS (
    SELECT pl.contato_id, pl.telefone_novo
    FROM payload pl
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contatos c2
      WHERE c2.empresa_id = p_empresa_id
        AND c2.telefone   = pl.telefone_novo
        AND c2.id        <> pl.contato_id
    )
  )
  UPDATE public.contatos c
  SET
    telefone   = safe.telefone_novo,
    updated_at = now()
  FROM safe
  WHERE c.id = safe.contato_id
    AND c.empresa_id = p_empresa_id
    AND c.telefone IS DISTINCT FROM safe.telefone_novo;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- Permissions (RPCs chamadas via service_role nas edge functions)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.claim_import_processing(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_import_processing(uuid, text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stale_imports_as_error()                TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_update_lead_ids(jsonb)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contatos_by_telefones(uuid, text[])      TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_update_telefones_contatos(uuid, jsonb)  TO service_role;
