CREATE OR REPLACE FUNCTION public.get_vendedores_atendimento(p_empresa_id uuid)
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    p.id,
    p.nome_completo AS nome,
    COALESCE(au.email::text, '') AS email
  FROM public.user_empresas ue
  JOIN public.profiles p ON p.id = ue.user_id
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE ue.empresa_id = p_empresa_id
    AND p.tipo_acesso::text = 'Vendedor'
    AND COALESCE(p.is_active, true) = true
    AND public.user_can_access_empresa(p_empresa_id, auth.uid())
  ORDER BY p.nome_completo NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendedores_atendimento(uuid) TO authenticated;