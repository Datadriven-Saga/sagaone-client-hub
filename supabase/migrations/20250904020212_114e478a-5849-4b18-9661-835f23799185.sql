-- Criar função para verificar se um email existe na auth.users
CREATE OR REPLACE FUNCTION public.check_user_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = email_to_check
  );
$$;