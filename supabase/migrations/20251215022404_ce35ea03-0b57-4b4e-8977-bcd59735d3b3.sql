-- Drop existing policies on profiles
DROP POLICY IF EXISTS "profiles_own_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_full_access" ON public.profiles;

-- Policy for admins - full access to all profiles
CREATE POLICY "profiles_admin_full_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policy for users to access their own profile
CREATE POLICY "profiles_own_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy for users to view profiles within the same company
CREATE POLICY "profiles_same_company_view" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = get_user_active_company(auth.uid())
    OR id = auth.uid()
    OR is_admin()
  );