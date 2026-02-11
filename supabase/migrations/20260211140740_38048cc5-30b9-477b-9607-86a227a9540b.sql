
-- Drop the recursive policy
DROP POLICY IF EXISTS "masters_can_manage" ON public.mfa_master_users;

-- Create separate policies for write operations only (not SELECT)
CREATE POLICY "masters_can_insert" ON public.mfa_master_users
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.mfa_master_users WHERE user_id = auth.uid()));

CREATE POLICY "masters_can_update" ON public.mfa_master_users
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mfa_master_users WHERE user_id = auth.uid()));

CREATE POLICY "masters_can_delete" ON public.mfa_master_users
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mfa_master_users WHERE user_id = auth.uid()));
