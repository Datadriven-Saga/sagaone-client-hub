
-- Remove overly permissive policy (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role full access to import logs" ON public.import_logs;

-- Add update policy for users to track their imports
CREATE POLICY "Users can update their company import logs"
ON public.import_logs FOR UPDATE
USING (empresa_id = get_user_active_company(auth.uid()));
