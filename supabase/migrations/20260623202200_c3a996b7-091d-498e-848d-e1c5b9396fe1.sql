
CREATE OR REPLACE FUNCTION public.claim_due_campaign_batches(p_limit integer DEFAULT 10, p_worker_id text DEFAULT 'cron'::text)
 RETURNS SETOF campaign_batches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT cb.id,
           ROW_NUMBER() OVER (
             PARTITION BY cb.job_id
             ORDER BY cb.scheduled_at ASC, cb.lot_index ASC NULLS LAST
           ) AS rn_per_job,
           cb.scheduled_at,
           cb.lot_index
    FROM public.campaign_batches cb
    JOIN public.campaign_jobs cj ON cj.id = cb.job_id
    JOIN public.prospeccoes p ON p.id = cj.prospeccao_id
    WHERE cb.status = 'scheduled'
      AND cb.scheduled_at <= now()
      AND cj.status IN ('scheduled','processing','partially_completed')
      AND cj.cancelled_at IS NULL
      AND COALESCE(p.disparos_pausados, false) = false
  ),
  due AS (
    SELECT r.id
    FROM ranked r
    ORDER BY r.rn_per_job ASC, r.scheduled_at ASC, r.lot_index ASC NULLS LAST
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
$function$;

CREATE OR REPLACE FUNCTION public.get_dispatcher_backlog()
 RETURNS TABLE(overdue_total bigint, jobs_overdue bigint, oldest_scheduled_at timestamptz)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*)::bigint AS overdue_total,
    COUNT(DISTINCT cb.job_id)::bigint AS jobs_overdue,
    MIN(cb.scheduled_at) AS oldest_scheduled_at
  FROM public.campaign_batches cb
  JOIN public.campaign_jobs cj ON cj.id = cb.job_id
  JOIN public.prospeccoes p ON p.id = cj.prospeccao_id
  WHERE cb.status = 'scheduled'
    AND cb.scheduled_at <= now()
    AND cj.status IN ('scheduled','processing','partially_completed')
    AND cj.cancelled_at IS NULL
    AND COALESCE(p.disparos_pausados, false) = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_dispatcher_backlog() TO authenticated, service_role;
