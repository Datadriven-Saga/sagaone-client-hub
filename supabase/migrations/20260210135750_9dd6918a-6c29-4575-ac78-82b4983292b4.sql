
-- Drop existing policies that query profiles directly (potential RLS conflict)
DROP POLICY IF EXISTS "Admins can view all MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can insert MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can update MFA accounts" ON public.mfa_accounts;
DROP POLICY IF EXISTS "Admins can delete MFA accounts" ON public.mfa_accounts;

-- Recreate using security definer function to avoid RLS recursion
CREATE POLICY "Admins can view all MFA accounts"
  ON public.mfa_accounts FOR SELECT TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can insert MFA accounts"
  ON public.mfa_accounts FOR INSERT TO authenticated
  WITH CHECK (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can update MFA accounts"
  ON public.mfa_accounts FOR UPDATE TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso))
  WITH CHECK (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can delete MFA accounts"
  ON public.mfa_accounts FOR DELETE TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

-- Fix recovery codes policies too
DROP POLICY IF EXISTS "Admins can view all recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can insert recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can update recovery codes" ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "Admins can delete recovery codes" ON public.mfa_recovery_codes;

CREATE POLICY "Admins can view all recovery codes"
  ON public.mfa_recovery_codes FOR SELECT TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can insert recovery codes"
  ON public.mfa_recovery_codes FOR INSERT TO authenticated
  WITH CHECK (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can update recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));

CREATE POLICY "Admins can delete recovery codes"
  ON public.mfa_recovery_codes FOR DELETE TO authenticated
  USING (get_current_user_access_type() IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso));
