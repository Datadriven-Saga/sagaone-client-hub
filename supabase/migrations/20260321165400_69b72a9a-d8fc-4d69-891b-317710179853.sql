-- Drop existing restrictive policies
DROP POLICY IF EXISTS "mfa_master_users_insert" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_users_delete" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_users_update" ON public.mfa_master_users;

-- Recreate with broader access: Master, Administrador, TI
CREATE POLICY "mfa_master_users_insert" ON public.mfa_master_users
  FOR INSERT TO authenticated
  WITH CHECK (
    is_mfa_master(auth.uid())
    OR get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
  );

CREATE POLICY "mfa_master_users_delete" ON public.mfa_master_users
  FOR DELETE TO authenticated
  USING (
    is_mfa_master(auth.uid())
    OR get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
  );

CREATE POLICY "mfa_master_users_update" ON public.mfa_master_users
  FOR UPDATE TO authenticated
  USING (
    is_mfa_master(auth.uid())
    OR get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
  );