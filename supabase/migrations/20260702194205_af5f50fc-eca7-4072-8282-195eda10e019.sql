
CREATE OR REPLACE FUNCTION public.get_email_by_profile_id(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = p_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_profile_id(uuid) TO authenticated;
