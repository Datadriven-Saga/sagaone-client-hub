-- Migrar dados de prospecção e contatos para a empresa ativa do usuário
-- Primeiro, vamos identificar a empresa ativa do usuário
WITH empresa_ativa AS (
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = true
)
UPDATE public.prospeccoes 
SET empresa_id = (SELECT empresa_id FROM empresa_ativa)
WHERE empresa_id = '00000000-0000-0000-0000-000000000001' 
AND responsavel_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00';

-- Migrar contatos para a empresa ativa
WITH empresa_ativa AS (
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = true
)
UPDATE public.contatos 
SET empresa_id = (SELECT empresa_id FROM empresa_ativa)
WHERE empresa_id = '00000000-0000-0000-0000-000000000001';

-- Migrar clientes para a empresa ativa
WITH empresa_ativa AS (
  SELECT empresa_id 
  FROM public.user_empresas 
  WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
  AND is_ativa = true
)
UPDATE public.clientes 
SET empresa_id = (SELECT empresa_id FROM empresa_ativa)
WHERE empresa_id = '00000000-0000-0000-0000-000000000001';

-- Corrigir a função para verificar empresa ativa de forma mais robusta
CREATE OR REPLACE FUNCTION public.get_user_active_company(user_id_param uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH user_active_empresa AS (
    SELECT ue.empresa_id 
    FROM public.user_empresas ue
    WHERE ue.user_id = user_id_param AND ue.is_ativa = true
    LIMIT 1
  ),
  profile_empresa AS (
    SELECT p.empresa_id 
    FROM public.profiles p 
    WHERE p.id = user_id_param
  )
  SELECT COALESCE(
    (SELECT empresa_id FROM user_active_empresa),
    (SELECT empresa_id FROM profile_empresa)
  );
$$;