
DROP FUNCTION IF EXISTS public.auto_atribuir_leads_vendedor(uuid);

CREATE OR REPLACE FUNCTION public.auto_atribuir_leads_vendedor(user_id_param uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  leads_pendentes integer;
  leads_a_atribuir integer;
  user_email text;
  user_nome text;
  empresa_id_param uuid;
  leads_atribuidos integer := 0;
BEGIN
  SELECT 
    get_current_user_email(),
    p.nome_completo,
    get_user_active_company(user_id_param)
  INTO user_email, user_nome, empresa_id_param
  FROM profiles p
  WHERE p.id = user_id_param;

  leads_pendentes := count_vendedor_leads_pendentes(user_id_param);
  leads_a_atribuir := GREATEST(0, 30 - leads_pendentes);
  
  IF leads_a_atribuir <= 0 THEN
    RETURN 0;
  END IF;
  
  WITH leads_disponiveis AS (
    SELECT DISTINCT c.id
    FROM contatos c
    INNER JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    INNER JOIN prospeccoes pr ON pr.id = ep.prospeccao_id 
      AND pr.empresa_id = empresa_id_param
      AND pr.canal IN ('Grande Evento', 'Mensal')
    WHERE c.empresa_id = empresa_id_param
      AND c.status = 'Novo'::status_lead
      AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
      AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
    ORDER BY c.id
    LIMIT leads_a_atribuir
  )
  UPDATE contatos
  SET 
    responsavel_email = user_email,
    vendedor_nome = user_nome,
    status = 'Atribuído'::status_lead,
    updated_at = now()
  WHERE id IN (SELECT id FROM leads_disponiveis);
  
  GET DIAGNOSTICS leads_atribuidos = ROW_COUNT;
  
  RETURN leads_atribuidos;
END;
$$;
