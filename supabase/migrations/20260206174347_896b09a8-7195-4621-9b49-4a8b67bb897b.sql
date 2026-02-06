
-- Recriar as policies que foram dropadas na migration anterior (que falhou parcialmente)
-- As policies foram dropadas mas a função falhou, então precisamos recriá-las

-- Verificar e recriar profiles SELECT policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR is_admin()
  OR (
    get_current_user_access_type() IN (
      'TI'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso,
      'CRM'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Proprietário'::tipo_acesso,
      'Coordenadora de Leads'::tipo_acesso
    )
    AND user_belongs_to_company(id, get_user_active_company(auth.uid()))
  )
);

-- Verificar e recriar user_empresas SELECT policy
DROP POLICY IF EXISTS "user_empresas_users_view_own_or_manager" ON public.user_empresas;
CREATE POLICY "user_empresas_users_view_own_or_manager" ON public.user_empresas
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin()
  OR (
    get_current_user_access_type() IN (
      'TI'::tipo_acesso,
      'Gerente de Leads'::tipo_acesso,
      'Gerente de Loja'::tipo_acesso,
      'CRM'::tipo_acesso,
      'Diretor'::tipo_acesso,
      'Proprietário'::tipo_acesso,
      'Coordenadora de Leads'::tipo_acesso
    )
    AND empresa_id = get_user_active_company(auth.uid())
  )
);
