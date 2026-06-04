CREATE OR REPLACE FUNCTION public.list_seat_usage()
 RETURNS TABLE(empresa_id uuid, nome_empresa text, max_seats integer, in_use bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    e.id,
    e.nome_empresa,
    COALESCE(esl.max_seats, 5)::int AS max_seats,
    COALESCE((
      SELECT count(*) FROM public.external_access_seats s
      JOIN public.profiles p ON p.id = s.profile_id
      WHERE s.empresa_id = e.id
        AND s.status = 'active'
        AND p.is_active = true
    ), 0) AS in_use
  FROM public.empresas e
  LEFT JOIN public.external_seat_limits esl ON esl.empresa_id = e.id
  WHERE public.is_admin()
  ORDER BY e.nome_empresa;
$function$;