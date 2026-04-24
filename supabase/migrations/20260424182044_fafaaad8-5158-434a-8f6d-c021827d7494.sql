CREATE OR REPLACE FUNCTION public.get_contatos_metricas(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'totalBase', COUNT(*),
    'novos', COUNT(*) FILTER (WHERE status = 'Novo'),
    'atribuidos', COUNT(*) FILTER (WHERE status = 'Atribuído'),
    'emEspera', COUNT(*) FILTER (WHERE status = 'Em Espera'),
    'convidados', COUNT(*) FILTER (WHERE status = 'Convidado'),
    'agendados', 0,
    'confirmados', COUNT(*) FILTER (WHERE status = 'Confirmado'),
    'checkin', COUNT(*) FILTER (WHERE status = 'Check-in'),
    'vendas', COUNT(*) FILTER (WHERE status = 'Venda'),
    'descartados', COUNT(*) FILTER (WHERE status = 'Descartado'),
    'optOut', COUNT(*) FILTER (WHERE status = 'Opt Out'),
    'desperdicio', 0
  )
  FROM public.contatos
  WHERE empresa_id = p_empresa_id;
$$;