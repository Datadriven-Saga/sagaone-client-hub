
-- Table to store department-level permission assignments
CREATE TABLE public.departamento_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento TEXT NOT NULL,
  permissao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(departamento, permissao)
);

-- Enable RLS
ALTER TABLE public.departamento_permissoes ENABLE ROW LEVEL SECURITY;

-- Only Administrador can manage permissions
CREATE POLICY "departamento_permissoes_admin_only"
ON public.departamento_permissoes
FOR ALL
USING (get_current_user_access_type() = 'Administrador'::tipo_acesso)
WITH CHECK (get_current_user_access_type() = 'Administrador'::tipo_acesso);

-- Trigger for updated_at
CREATE TRIGGER update_departamento_permissoes_updated_at
BEFORE UPDATE ON public.departamento_permissoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
