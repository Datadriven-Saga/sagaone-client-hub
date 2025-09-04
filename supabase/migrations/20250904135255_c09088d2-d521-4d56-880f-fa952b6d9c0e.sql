-- Corrigir problema de múltiplas empresas ativas para o mesmo usuário
UPDATE public.user_empresas 
SET is_ativa = FALSE, updated_at = now()
WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
AND is_ativa = TRUE;

-- Ativar apenas a primeira empresa (mais antiga)
UPDATE public.user_empresas 
SET is_ativa = TRUE, updated_at = now()
WHERE user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00' 
AND empresa_id = (
  SELECT ue.empresa_id 
  FROM public.user_empresas ue 
  WHERE ue.user_id = 'e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00'
  ORDER BY ue.created_at ASC 
  LIMIT 1
);