
CREATE TABLE public.sso_secret_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'azure',
  client_id TEXT NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  alert_at TIMESTAMPTZ NOT NULL,
  last_alerted_at TIMESTAMPTZ,
  alert_count INTEGER NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_secret_rotations TO authenticated;
GRANT ALL ON public.sso_secret_rotations TO service_role;

ALTER TABLE public.sso_secret_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sso rotations"
ON public.sso_secret_rotations FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.tipo_acesso IN ('Master','TI','Administrador') AND p.is_active = true)
);

CREATE POLICY "Admins can insert sso rotations"
ON public.sso_secret_rotations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.tipo_acesso IN ('Master','TI','Administrador') AND p.is_active = true)
);

CREATE POLICY "Admins can update sso rotations"
ON public.sso_secret_rotations FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.tipo_acesso IN ('Master','TI','Administrador') AND p.is_active = true)
);

CREATE INDEX idx_sso_secret_rotations_pending
  ON public.sso_secret_rotations (alert_at)
  WHERE resolved_at IS NULL;

CREATE TRIGGER trg_sso_secret_rotations_updated_at
  BEFORE UPDATE ON public.sso_secret_rotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial: rotação de hoje, valida 24 meses, alerta 30 dias antes
INSERT INTO public.sso_secret_rotations (provider, client_id, rotated_at, expires_at, alert_at)
VALUES (
  'azure',
  'e00d4b5a-ae41-426f-ada6-ad136b7bd835',
  now(),
  now() + interval '24 months',
  now() + interval '24 months' - interval '30 days'
);

-- Cron diário para verificar expiração
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
