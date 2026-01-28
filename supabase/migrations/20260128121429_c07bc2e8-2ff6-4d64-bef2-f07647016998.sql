-- Fix: Create an overload of user_can_access_empresa that accepts only 1 parameter
-- Uses auth.uid() internally for the user_id parameter

CREATE OR REPLACE FUNCTION public.user_can_access_empresa(target_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.user_can_access_empresa(auth.uid(), target_empresa_id);
$$;