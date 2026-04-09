-- Fix count_vendedor_leads_pendentes: exclude 'Novo' status since those leads
-- are invisible in the limited Kanban (column Novo only shows unassigned leads).
-- Only count 'Atribuído' and 'Em Espera' which are actually visible/actionable.
CREATE OR REPLACE FUNCTION public.count_vendedor_leads_pendentes(user_id_param uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.contatos c
  WHERE c.empresa_id = get_user_active_company(user_id_param)
    AND c.status IN ('Atribuído'::status_lead, 'Em Espera'::status_lead)
    AND (
      c.responsavel_email = get_current_user_email()
      OR c.vendedor_nome = (SELECT p.nome_completo FROM profiles p WHERE p.id = user_id_param)
    );
$$;

-- Also fix vendedor_precisa_leads to match
CREATE OR REPLACE FUNCTION public.vendedor_precisa_leads(user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count_vendedor_leads_pendentes(user_id_param) < 30;
$$;