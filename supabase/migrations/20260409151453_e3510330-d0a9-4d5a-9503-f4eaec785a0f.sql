
DROP FUNCTION IF EXISTS public.count_vendedor_leads_pendentes(uuid);

CREATE OR REPLACE FUNCTION public.count_vendedor_leads_pendentes(user_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.contatos c
  WHERE c.empresa_id = get_user_active_company(user_id_param)
    AND c.status = 'Atribuído'::status_lead
    AND (
      c.responsavel_email = get_current_user_email()
      OR c.vendedor_nome = (SELECT p.nome_completo FROM profiles p WHERE p.id = user_id_param)
    );
$$;
