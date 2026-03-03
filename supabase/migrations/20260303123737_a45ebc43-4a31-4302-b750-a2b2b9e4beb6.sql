-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Users can view quarantine for their company" ON public.contato_quarentena;

-- Admins see all, others see only their active company
CREATE POLICY "Users can view quarantine"
ON public.contato_quarentena
FOR SELECT
USING (
  public.check_user_is_admin(auth.uid())
  OR empresa_id = public.get_user_active_company(auth.uid())
);

-- Also fix UPDATE policy for admins
DROP POLICY IF EXISTS "Users can update quarantine for their company" ON public.contato_quarentena;

CREATE POLICY "Users can update quarantine"
ON public.contato_quarentena
FOR UPDATE
USING (
  public.check_user_is_admin(auth.uid())
  OR empresa_id = public.get_user_active_company(auth.uid())
);

-- Also fix quarentena_logs SELECT for admins
DROP POLICY IF EXISTS "Admins can view quarantine logs" ON public.quarentena_logs;

CREATE POLICY "Admins can view quarantine logs"
ON public.quarentena_logs
FOR SELECT
USING (
  public.check_user_is_admin(auth.uid())
  OR empresa_id = public.get_user_active_company(auth.uid())
);