
ALTER TABLE public.campaign_jobs
  ADD COLUMN IF NOT EXISTS duplicate_records int NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_jobs_active_per_prospeccao
  ON public.campaign_jobs(empresa_id, prospeccao_id)
  WHERE status IN ('pending','processing');

CREATE TABLE IF NOT EXISTS public.logs_disparos_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.campaign_jobs(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.campaign_batches(id) ON DELETE SET NULL,
  empresa_id uuid NOT NULL,
  prospeccao_id uuid,
  contato_id uuid,
  lead_id text,
  telefone text,
  nome text,
  categoria text NOT NULL,
  mensagem text,
  http_status int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.logs_disparos_falhas TO authenticated;
GRANT ALL ON public.logs_disparos_falhas TO service_role;

ALTER TABLE public.logs_disparos_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso por empresa"
  ON public.logs_disparos_falhas
  FOR SELECT
  TO authenticated
  USING (public.user_can_access_empresa(empresa_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_logs_disparos_falhas_job
  ON public.logs_disparos_falhas(job_id);

CREATE INDEX IF NOT EXISTS idx_logs_disparos_falhas_empresa_data
  ON public.logs_disparos_falhas(empresa_id, created_at DESC);
