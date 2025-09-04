-- Corrigir o warning de search_path mutável
CREATE OR REPLACE FUNCTION public.check_password_protection_status()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Password leak protection should be enabled in Supabase Auth settings'::text;
$$;