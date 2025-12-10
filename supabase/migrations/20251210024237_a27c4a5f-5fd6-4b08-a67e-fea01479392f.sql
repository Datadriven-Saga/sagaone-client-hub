-- Fix 1: Remove unrestricted INSERT policies on profiles table
-- Profiles are created automatically by the handle_new_user() trigger, no manual INSERT needed
DROP POLICY IF EXISTS "profiles_system_insert_new_users" ON profiles;
DROP POLICY IF EXISTS "rls_profiles_system_insert" ON profiles;

-- Fix 2: Replace unrestricted opt_outs policy with proper empresa_id scoping
DROP POLICY IF EXISTS "opt_outs_authenticated_access" ON opt_outs;

-- Create proper RLS policy for opt_outs - users can only access their company's opt-outs
CREATE POLICY "opt_outs_empresa_users_all" ON opt_outs
  FOR ALL 
  USING (empresa_id = get_user_active_company(auth.uid()))
  WITH CHECK (empresa_id = get_user_active_company(auth.uid()));