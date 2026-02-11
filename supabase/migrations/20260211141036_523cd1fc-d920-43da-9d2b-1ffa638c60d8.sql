
-- Drop ALL existing policies on mfa_master_users
DROP POLICY IF EXISTS "Only master can view master_users" ON public.mfa_master_users;
DROP POLICY IF EXISTS "authenticated_can_read_master_users" ON public.mfa_master_users;
DROP POLICY IF EXISTS "masters_can_insert" ON public.mfa_master_users;
DROP POLICY IF EXISTS "masters_can_update" ON public.mfa_master_users;
DROP POLICY IF EXISTS "masters_can_delete" ON public.mfa_master_users;

-- Simple SELECT: all authenticated can read (table only has user_ids, no sensitive data)
CREATE POLICY "mfa_master_users_select" ON public.mfa_master_users
  FOR SELECT TO authenticated
  USING (true);

-- Write policies use is_mfa_master() which is SECURITY DEFINER (bypasses RLS, no recursion)
CREATE POLICY "mfa_master_users_insert" ON public.mfa_master_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mfa_master(auth.uid()));

CREATE POLICY "mfa_master_users_update" ON public.mfa_master_users
  FOR UPDATE TO authenticated
  USING (public.is_mfa_master(auth.uid()));

CREATE POLICY "mfa_master_users_delete" ON public.mfa_master_users
  FOR DELETE TO authenticated
  USING (public.is_mfa_master(auth.uid()));
