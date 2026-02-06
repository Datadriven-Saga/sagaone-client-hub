-- Gestores precisam ver user_empresas de todos da mesma empresa para montar equipes
DROP POLICY IF EXISTS "user_empresas_users_view_own" ON public.user_empresas;

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
      'Proprietário'::tipo_acesso
    )
    AND empresa_id = get_user_active_company(auth.uid())
  )
);