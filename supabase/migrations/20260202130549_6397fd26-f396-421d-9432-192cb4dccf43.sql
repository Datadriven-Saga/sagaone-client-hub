-- Fix RLS policies to allow Admin/TI to see ALL trainings and simulations
-- regardless of empresa_id (for the admin panel)

-- Drop existing policies
DROP POLICY IF EXISTS academy_treinamentos_gestores_full ON public.academy_treinamentos;
DROP POLICY IF EXISTS academy_simulacoes_gestores_full ON public.academy_simulacoes;

-- Recreate policies: Admin/TI can see/manage ALL records (no empresa_id filter)
CREATE POLICY academy_treinamentos_gestores_full ON public.academy_treinamentos
FOR ALL
TO authenticated
USING (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
WITH CHECK (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]));

CREATE POLICY academy_simulacoes_gestores_full ON public.academy_simulacoes
FOR ALL
TO authenticated
USING (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]))
WITH CHECK (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso, 'TI'::tipo_acesso]));

-- Add separate policies for Gerentes (filtered by their empresa_id)
CREATE POLICY academy_treinamentos_gerentes_empresa ON public.academy_treinamentos
FOR ALL
TO authenticated
USING (
  get_current_user_access_type() = ANY (ARRAY['Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
  AND (empresa_id IS NULL OR empresa_id = get_user_active_company(auth.uid()))
)
WITH CHECK (
  get_current_user_access_type() = ANY (ARRAY['Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);

CREATE POLICY academy_simulacoes_gerentes_empresa ON public.academy_simulacoes
FOR ALL
TO authenticated
USING (
  get_current_user_access_type() = ANY (ARRAY['Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
  AND (empresa_id IS NULL OR empresa_id = get_user_active_company(auth.uid()))
  AND ativo = true
)
WITH CHECK (
  get_current_user_access_type() = ANY (ARRAY['Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'Diretor'::tipo_acesso])
);