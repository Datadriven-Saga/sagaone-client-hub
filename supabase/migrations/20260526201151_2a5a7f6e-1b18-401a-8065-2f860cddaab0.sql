UPDATE public.contatos c
SET responsavel_email = u.email
FROM auth.users u
WHERE c.responsavel_email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id::text = lower(c.responsavel_email);