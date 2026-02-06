-- Atualizar policy de SELECT em profiles para incluir gestores (Gerente de Leads, Gerente de Loja, CRM)
-- que precisam ver profiles de SDR/Vendedor da mesma empresa para atribuir equipes
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  (id = auth.uid())
  OR is_admin()
  OR (
    get_current_user_access_type() IN ('TI'::tipo_acesso, 'Gerente de Leads'::tipo_acesso, 'Gerente de Loja'::tipo_acesso, 'CRM'::tipo_acesso)
    AND empresa_id = get_user_active_company(auth.uid())
  )
);