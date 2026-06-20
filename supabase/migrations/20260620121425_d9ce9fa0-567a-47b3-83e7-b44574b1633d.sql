
CREATE OR REPLACE FUNCTION public.claim_next_immediate_batch(p_job_id uuid)
RETURNS TABLE(id uuid, batch_index integer, prev_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_batch_index integer;
  v_prev_status text;
BEGIN
  WITH cte AS (
    SELECT b.id, b.batch_index, b.status
    FROM campaign_batches b
    WHERE b.job_id = p_job_id
      AND b.lot_index IS NULL
      AND COALESCE(b.retry_count, 0) < 3
      AND (
        b.status IN ('pending','failed')
        OR (b.status = 'processing' AND b.updated_at < now() - interval '10 minutes')
      )
    ORDER BY
      CASE WHEN b.status = 'processing' THEN 0 ELSE 1 END,
      b.batch_index
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE campaign_batches b
  SET status = 'processing',
      started_at = COALESCE(b.started_at, now()),
      updated_at = now()
  FROM cte
  WHERE b.id = cte.id
  RETURNING b.id, b.batch_index, cte.status
  INTO v_id, v_batch_index, v_prev_status;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, v_batch_index, v_prev_status;
  END IF;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_immediate_batch(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_next_immediate_batch(uuid) FROM PUBLIC;

CREATE OR REPLACE VIEW public.vw_immediate_jobs_status
WITH (security_invoker = true) AS
SELECT
  j.id AS job_id,
  j.empresa_id,
  j.prospeccao_id,
  j.status AS job_status,
  j.total_records,
  j.processed_records,
  j.failed_records,
  j.started_at,
  j.updated_at,
  j.completed_at,
  COUNT(b.id) FILTER (WHERE b.lot_index IS NULL) AS immediate_batches_total,
  COUNT(b.id) FILTER (
    WHERE b.lot_index IS NULL
      AND (
        b.status IN ('pending','failed')
        OR (b.status = 'processing' AND b.updated_at < now() - interval '10 minutes')
      )
  ) AS immediate_open,
  CASE
    WHEN j.status IN ('completed','partially_completed','cancelled','failed') THEN 'concluido'
    WHEN COUNT(b.id) FILTER (
      WHERE b.lot_index IS NULL
        AND (
          b.status IN ('pending','failed')
          OR (b.status = 'processing' AND b.updated_at < now() - interval '10 minutes')
        )
    ) > 0 THEN 'orfao'
    ELSE 'vivo'
  END AS classificacao
FROM public.campaign_jobs j
LEFT JOIN public.campaign_batches b ON b.job_id = j.id
WHERE EXISTS (
  SELECT 1 FROM public.campaign_batches b2
  WHERE b2.job_id = j.id AND b2.lot_index IS NULL
)
  AND public.user_can_access_empresa(j.empresa_id, auth.uid())
GROUP BY j.id;

GRANT SELECT ON public.vw_immediate_jobs_status TO authenticated;
GRANT SELECT ON public.vw_immediate_jobs_status TO service_role;
