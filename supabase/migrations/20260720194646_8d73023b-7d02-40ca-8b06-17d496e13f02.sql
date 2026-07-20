
CREATE OR REPLACE FUNCTION public.reset_leads_evento_sem_log(p_prospeccao_id uuid)
RETURNS TABLE(logs_inseridos int, responsaveis_limpos int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'reset_leads_evento_sem_log foi desativada por segurança. Use um plano auditado de correção por logs corretivos, sem resetar leads para Novo.';
END;
$$;
