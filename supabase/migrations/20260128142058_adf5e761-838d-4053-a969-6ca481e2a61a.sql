-- Add missing columns to treinamentos table
ALTER TABLE public.treinamentos 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'curso' CHECK (tipo IN ('voz', 'texto', 'curso')),
ADD COLUMN IF NOT EXISTS departamento TEXT,
ADD COLUMN IF NOT EXISTS dificuldade TEXT DEFAULT 'Médio' CHECK (dificuldade IN ('Fácil', 'Médio', 'Difícil')),
ADD COLUMN IF NOT EXISTS nota_minima NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS criado_por UUID;

-- Add index for departamento
CREATE INDEX IF NOT EXISTS idx_treinamentos_departamento ON public.treinamentos(departamento);
CREATE INDEX IF NOT EXISTS idx_treinamentos_empresa ON public.treinamentos(empresa_id);

-- Drop existing policy and create new ones for proper role-based access
DROP POLICY IF EXISTS "treinamentos_company_users" ON public.treinamentos;

-- Admins/TI can manage all trainings
CREATE POLICY "treinamentos_admins_ti_full_access" ON public.treinamentos
  FOR ALL USING (
    get_current_user_access_type() IN ('Administrador', 'TI')
  );

-- Managers can view and create trainings for their company
CREATE POLICY "treinamentos_managers_access" ON public.treinamentos
  FOR ALL USING (
    get_current_user_access_type() IN ('Gerente de Leads', 'Gerente de Loja', 'Diretor') 
    AND (empresa_id IS NULL OR empresa_id = get_user_active_company(auth.uid()))
  )
  WITH CHECK (
    get_current_user_access_type() IN ('Gerente de Leads', 'Gerente de Loja', 'Diretor') 
    AND (empresa_id IS NULL OR empresa_id = get_user_active_company(auth.uid()))
  );

-- Regular users can view active trainings for their department or general
CREATE POLICY "treinamentos_users_select" ON public.treinamentos
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND COALESCE(ativo, true) = true
    AND (empresa_id IS NULL OR empresa_id = get_user_active_company(auth.uid()))
    AND (
      departamento IS NULL 
      OR departamento = (SELECT departamento FROM profiles WHERE id = auth.uid())
    )
  );

-- Create trigger for updated_at if not exists
DROP TRIGGER IF EXISTS update_treinamentos_updated_at ON public.treinamentos;
CREATE TRIGGER update_treinamentos_updated_at
  BEFORE UPDATE ON public.treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();