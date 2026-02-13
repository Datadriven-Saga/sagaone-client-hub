
-- ===========================================
-- TABELA: campaign_jobs - Registro de cada disparo em massa
-- ===========================================
CREATE TABLE public.campaign_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospeccao_id UUID NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  canal TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  quantidade_solicitada INTEGER, -- NULL = todos
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- TABELA: campaign_batches - Cada lote de 1000
-- ===========================================
CREATE TABLE public.campaign_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.campaign_jobs(id) ON DELETE CASCADE,
  batch_index INTEGER NOT NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  processed_leads INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,
  lead_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_campaign_jobs_empresa ON public.campaign_jobs(empresa_id);
CREATE INDEX idx_campaign_jobs_prospeccao ON public.campaign_jobs(prospeccao_id);
CREATE INDEX idx_campaign_jobs_status ON public.campaign_jobs(status);
CREATE INDEX idx_campaign_jobs_user ON public.campaign_jobs(user_id);
CREATE INDEX idx_campaign_batches_job ON public.campaign_batches(job_id);
CREATE INDEX idx_campaign_batches_status ON public.campaign_batches(status);

-- Habilitar RLS
ALTER TABLE public.campaign_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_batches ENABLE ROW LEVEL SECURITY;

-- Habilitar Realtime para campaign_jobs (progresso em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_jobs;

-- RLS Policies para campaign_jobs
CREATE POLICY "Users can view jobs from their company"
ON public.campaign_jobs FOR SELECT
USING (empresa_id = get_user_active_company(auth.uid()));

CREATE POLICY "Admins and managers can create jobs"
ON public.campaign_jobs FOR INSERT
WITH CHECK (
  empresa_id = get_user_active_company(auth.uid())
  AND get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Master'::tipo_acesso)
);

CREATE POLICY "Users can update their own jobs"
ON public.campaign_jobs FOR UPDATE
USING (empresa_id = get_user_active_company(auth.uid()));

-- RLS Policies para campaign_batches
CREATE POLICY "Users can view batches from their company jobs"
ON public.campaign_batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaign_jobs cj
    WHERE cj.id = campaign_batches.job_id
    AND cj.empresa_id = get_user_active_company(auth.uid())
  )
);

CREATE POLICY "System can manage batches"
ON public.campaign_batches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.campaign_jobs cj
    WHERE cj.id = campaign_batches.job_id
    AND cj.empresa_id = get_user_active_company(auth.uid())
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_campaign_jobs_updated_at
  BEFORE UPDATE ON public.campaign_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_batches_updated_at
  BEFORE UPDATE ON public.campaign_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
