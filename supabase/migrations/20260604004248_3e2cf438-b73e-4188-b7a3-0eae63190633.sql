-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.logs_cadeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acao TEXT NOT NULL CHECK (acao IN ('create','renew','activate','deactivate')),
  empresa_id UUID,
  prospeccao_id UUID,
  profile_id UUID,
  email TEXT,
  executado_por UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_empresa ON public.logs_cadeiras(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_profile ON public.logs_cadeiras(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_cadeiras_acao ON public.logs_cadeiras(acao, created_at DESC);

-- 2) GRANTs
GRANT SELECT ON public.logs_cadeiras TO authenticated;
GRANT ALL ON public.logs_cadeiras TO service_role;

-- 3) RLS
ALTER TABLE public.logs_cadeiras ENABLE ROW LEVEL SECURITY;

-- 4) Policies: apenas Admin/TI/Master leem
CREATE POLICY "Admin/TI/Master read logs_cadeiras"
  ON public.logs_cadeiras
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND tipo_acesso IN ('Administrador','TI','Master')
    )
  );

-- service_role insere via edge (não precisa policy para service_role, mas mantemos consistência)
CREATE POLICY "Service role full access logs_cadeiras"
  ON public.logs_cadeiras
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);