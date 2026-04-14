
CREATE OR REPLACE FUNCTION public.get_users_with_email(
  p_tipo_acesso_filter text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  email text,
  nome_completo text,
  tipo_acesso text,
  departamento text,
  celular text,
  cpf text,
  status text,
  empresa_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    COALESCE(au.email::text, 'Email não disponível') AS email,
    p.nome_completo,
    p.tipo_acesso::text,
    p.departamento,
    p.celular,
    p.cpf,
    p.status,
    p.empresa_id,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.tipo_acesso IS DISTINCT FROM 'Sistema'::tipo_acesso
    AND (p_tipo_acesso_filter IS NULL OR p.tipo_acesso::text = ANY(p_tipo_acesso_filter))
  ORDER BY p.created_at DESC
  LIMIT 200;
$$;
