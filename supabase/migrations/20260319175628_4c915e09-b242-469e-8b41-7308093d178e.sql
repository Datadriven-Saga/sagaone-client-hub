-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create import logs for their company" ON public.import_logs;

-- Create a more flexible INSERT policy that allows inserting for any company the user belongs to
CREATE POLICY "Users can create import logs for their company"
ON public.import_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    empresa_id = get_user_active_company(auth.uid())
    OR public.user_belongs_to_company(auth.uid(), empresa_id)
  )
);