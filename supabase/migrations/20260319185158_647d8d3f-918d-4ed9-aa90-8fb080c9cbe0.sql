-- Clean up duplicate active recovery logs: keep only the newest per id_meta_original, cancel the rest
WITH ranked AS (
  SELECT id, 
    ROW_NUMBER() OVER (PARTITION BY id_meta_original ORDER BY created_at DESC) as rn
  FROM public.template_pausado_log
  WHERE status NOT IN ('failed', 'resolved', 'cancelled')
)
UPDATE public.template_pausado_log
SET status = 'cancelled', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Now create the unique partial index for atomic deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_pausado_log_active_recovery
ON public.template_pausado_log (id_meta_original)
WHERE status NOT IN ('failed', 'resolved', 'cancelled');