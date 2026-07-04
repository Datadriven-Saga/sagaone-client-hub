REVOKE EXECUTE ON FUNCTION public.get_vendedores_atendimento(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendedores_atendimento(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendedores_atendimento(uuid) TO authenticated;