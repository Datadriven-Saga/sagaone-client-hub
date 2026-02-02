-- Função para contar leads pendentes do vendedor (Novo, Atribuído, Em Espera)
CREATE OR REPLACE FUNCTION public.count_vendedor_leads_pendentes(user_id_param uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.contatos c
  WHERE c.empresa_id = get_user_active_company(user_id_param)
    AND c.status IN ('Novo'::status_lead, 'Atribuído'::status_lead, 'Em Espera'::status_lead)
    AND (
      c.responsavel_email = get_current_user_email()
      OR c.vendedor_nome = (SELECT p.nome_completo FROM profiles p WHERE p.id = user_id_param)
    );
$$;

-- Função para atribuir automaticamente leads novos ao vendedor (máximo 30)
CREATE OR REPLACE FUNCTION public.auto_atribuir_leads_vendedor(user_id_param uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  leads_pendentes integer;
  leads_a_atribuir integer;
  user_email text;
  user_nome text;
  empresa_id_param uuid;
  leads_atribuidos integer := 0;
BEGIN
  -- Pega informações do usuário
  SELECT 
    get_current_user_email(),
    p.nome_completo,
    get_user_active_company(user_id_param)
  INTO user_email, user_nome, empresa_id_param
  FROM profiles p
  WHERE p.id = user_id_param;

  -- Conta quantos leads pendentes o vendedor já tem
  leads_pendentes := count_vendedor_leads_pendentes(user_id_param);
  
  -- Calcula quantos leads pode receber (máximo 30)
  leads_a_atribuir := GREATEST(0, 30 - leads_pendentes);
  
  -- Se já tem 30 ou mais, não atribui nada
  IF leads_a_atribuir <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Atribui leads "Novos" sem responsável ao vendedor
  WITH leads_disponiveis AS (
    SELECT c.id
    FROM contatos c
    WHERE c.empresa_id = empresa_id_param
      AND c.status = 'Novo'::status_lead
      AND (c.responsavel_email IS NULL OR c.responsavel_email = '')
      AND (c.vendedor_nome IS NULL OR c.vendedor_nome = '')
    ORDER BY c.created_at ASC
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

-- Função para verificar se vendedor precisa de mais leads
CREATE OR REPLACE FUNCTION public.vendedor_precisa_leads(user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count_vendedor_leads_pendentes(user_id_param) < 30;
$$;