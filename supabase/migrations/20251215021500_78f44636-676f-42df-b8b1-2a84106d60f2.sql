-- Drop existing policies and recreate with explicit authentication requirement
DROP POLICY IF EXISTS "profiles_admin_full_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_access" ON public.profiles;

-- Policy for users to manage their own profile (only authenticated users)
CREATE POLICY "profiles_own_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy for admins to manage all profiles (only authenticated users)
CREATE POLICY "profiles_admin_full_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());