
-- Table for per-store feature flag overrides
CREATE TABLE public.feature_flag_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.system_feature_flags(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(flag_id, empresa_id)
);

-- RLS
ALTER TABLE public.feature_flag_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature_flag_empresas"
  ON public.feature_flag_empresas
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read feature_flag_empresas"
  ON public.feature_flag_empresas
  FOR SELECT
  TO authenticated
  USING (true);

-- Add scope column to system_feature_flags to know which flags support per-store
ALTER TABLE public.system_feature_flags ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';

-- Mark the cadencia completa flag as per-store
UPDATE public.system_feature_flags SET scope = 'per_empresa' WHERE flag_key = 'pri_whats_cadencia_completa';

-- Function to check if a flag is enabled for a specific empresa
CREATE OR REPLACE FUNCTION public.is_feature_enabled_for_empresa(p_flag_key text, p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT 
        CASE 
          WHEN sf.scope = 'per_empresa' THEN
            COALESCE(
              (SELECT ffe.is_enabled FROM public.feature_flag_empresas ffe WHERE ffe.flag_id = sf.id AND ffe.empresa_id = p_empresa_id),
              false
            )
          ELSE sf.is_enabled
        END
      FROM public.system_feature_flags sf
      WHERE sf.flag_key = p_flag_key
    ),
    false
  );
$$;
