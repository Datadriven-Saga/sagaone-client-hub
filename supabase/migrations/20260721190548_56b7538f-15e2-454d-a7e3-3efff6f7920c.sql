CREATE OR REPLACE FUNCTION public.count_vendedor_leads_pendentes(user_id_param uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT get_user_active_company(user_id_param) AS emp,
           get_current_user_email() AS email,
           (SELECT p.nome_completo FROM profiles p WHERE p.id = user_id_param) AS nome
  )
  SELECT COALESCE(COUNT(DISTINCT c.id)::integer, 0)
  FROM me, public.contatos c
  WHERE c.empresa_id = me.emp
    AND (c.responsavel_email = me.email OR c.vendedor_nome = me.nome)
    AND (
      c.status = 'Atribuído'::status_lead
      OR EXISTS (
        SELECT 1 FROM public.eventos_prospeccao ep
        WHERE ep.contato_id = c.id
          AND public.get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Atribuído'
      )
    );
$function$;