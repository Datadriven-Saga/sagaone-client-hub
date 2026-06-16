
-- Fase 1: Schema para Programar Disparos WhatsApp

ALTER TABLE public.campaign_jobs
  ADD COLUMN IF NOT EXISTS dispatch_mode text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS cadence_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS interval_minutes integer,
  ADD COLUMN IF NOT EXISTS first_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

ALTER TABLE public.campaign_batches
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lot_index integer,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

-- Índice parcial para o dispatcher
CREATE INDEX IF NOT EXISTS idx_campaign_batches_scheduled_due
  ON public.campaign_batches (scheduled_at)
  WHERE status = 'scheduled';

-- Índice único para evitar agendamento duplicado no mesmo slot
-- (não bloqueia disparo imediato pois usa status='scheduled')
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_jobs_scheduled_slot
  ON public.campaign_jobs (empresa_id, prospeccao_id, first_scheduled_at)
  WHERE status = 'scheduled';

-- RPC: claim batches devidos (compare-and-swap atômico)
CREATE OR REPLACE FUNCTION public.claim_due_campaign_batches(
  p_limit integer DEFAULT 10,
  p_worker_id text DEFAULT 'cron'
)
RETURNS SETOF public.campaign_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT cb.id
    FROM public.campaign_batches cb
    JOIN public.campaign_jobs cj ON cj.id = cb.job_id
    JOIN public.prospeccoes p ON p.id = cj.prospeccao_id
    WHERE cb.status = 'scheduled'
      AND cb.scheduled_at <= now()
      AND cj.status IN ('scheduled','processing','partially_completed')
      AND cj.cancelled_at IS NULL
      AND COALESCE(p.disparos_pausados, false) = false
    ORDER BY cb.scheduled_at ASC, cb.lot_index ASC NULLS LAST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.campaign_batches cb
  SET status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = COALESCE(cb.started_at, now()),
      updated_at = now()
  FROM due
  WHERE cb.id = due.id
  RETURNING cb.*;
END;
$$;

-- RPC: incremento atômico de contadores
CREATE OR REPLACE FUNCTION public.increment_job_counters(
  p_job_id uuid,
  p_processed integer DEFAULT 0,
  p_failed integer DEFAULT 0,
  p_duplicate integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.campaign_jobs
  SET processed_records = COALESCE(processed_records, 0) + COALESCE(p_processed, 0),
      failed_records    = COALESCE(failed_records, 0)    + COALESCE(p_failed, 0),
      duplicate_records = COALESCE(duplicate_records, 0) + COALESCE(p_duplicate, 0),
      updated_at = now()
  WHERE id = p_job_id;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_campaign_batches(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_job_counters(uuid, integer, integer, integer) TO service_role, authenticated;
