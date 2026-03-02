
CREATE OR REPLACE FUNCTION public.get_users_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id as user_id, u.email::text as email
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
$$;
