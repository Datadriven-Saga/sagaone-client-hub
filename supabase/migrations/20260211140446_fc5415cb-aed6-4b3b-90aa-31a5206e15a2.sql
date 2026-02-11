
-- Drop existing policies on mfa_master_users that cause recursion
DROP POLICY IF EXISTS "mfa_master_users_select" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_users_insert" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_users_update" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_users_delete" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_select" ON public.mfa_master_users;
DROP POLICY IF EXISTS "mfa_master_manage" ON public.mfa_master_users;
DROP POLICY IF EXISTS "Masters can view master users" ON public.mfa_master_users;
DROP POLICY IF EXISTS "Masters can manage master users" ON public.mfa_master_users;

-- Simple policy: authenticated users can SELECT (the table only has user_ids, no sensitive data)
CREATE POLICY "authenticated_can_read_master_users" ON public.mfa_master_users
  FOR SELECT TO authenticated USING (true);

-- Only existing masters can INSERT/UPDATE/DELETE (use direct subquery, not the function)
CREATE POLICY "masters_can_manage" ON public.mfa_master_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mfa_master_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mfa_master_users WHERE user_id = auth.uid()));
