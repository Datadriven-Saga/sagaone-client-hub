
-- Tabela global de opt-out permanente
CREATE TABLE public.global_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado TEXT NOT NULL,
  motivo TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_opt_outs_telefone_unique UNIQUE (telefone_normalizado)
);

-- Index for fast lookups
CREATE INDEX idx_global_opt_outs_telefone ON public.global_opt_outs(telefone_normalizado);

-- Enable RLS
ALTER TABLE public.global_opt_outs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can manage global opt-outs"
  ON public.global_opt_outs
  FOR ALL
  TO authenticated
  USING (public.check_user_is_admin(auth.uid()))
  WITH CHECK (public.check_user_is_admin(auth.uid()));

-- Function to check if a phone is globally opted out
CREATE OR REPLACE FUNCTION public.check_global_opt_out(p_telefone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.global_opt_outs
    WHERE telefone_normalizado = p_telefone
  );
$$;

-- Bulk check function for import flows
CREATE OR REPLACE FUNCTION public.check_global_opt_out_bulk(p_telefones TEXT[])
RETURNS TABLE(telefone TEXT, bloqueado BOOLEAN)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    t.telefone,
    EXISTS (SELECT 1 FROM public.global_opt_outs g WHERE g.telefone_normalizado = t.telefone) AS bloqueado
  FROM unnest(p_telefones) AS t(telefone);
$$;
