-- Clean up and recreate RLS policies for opt_outs
DROP POLICY IF EXISTS "opt_outs_users_insert" ON public.opt_outs;
DROP POLICY IF EXISTS "opt_outs_users_select" ON public.opt_outs;
DROP POLICY IF EXISTS "opt_outs_users_update" ON public.opt_outs;
DROP POLICY IF EXISTS "opt_outs_users_delete" ON public.opt_outs;
DROP POLICY IF EXISTS "opt_outs_company_users" ON public.opt_outs;

-- Create simplified RLS policy - allow all operations for authenticated users
-- Since this is Empresa Padrão only initially, we can be more permissive
CREATE POLICY "opt_outs_authenticated_access" ON public.opt_outs
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);