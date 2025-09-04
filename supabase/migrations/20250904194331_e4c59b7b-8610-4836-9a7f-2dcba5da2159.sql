-- Corrigir colunas empresa_id para NOT NULL e adicionar constraint
-- Primeiro, garantir que todos os registros tenham empresa_id definido

-- Atualizar contatos sem empresa_id usando a função de empresa ativa
UPDATE public.contatos 
SET empresa_id = (
  SELECT ue.empresa_id 
  FROM public.user_empresas ue 
  WHERE ue.is_ativa = true 
  LIMIT 1
)
WHERE empresa_id IS NULL;

-- Atualizar prospeccoes sem empresa_id usando a função de empresa ativa
UPDATE public.prospeccoes 
SET empresa_id = (
  SELECT ue.empresa_id 
  FROM public.user_empresas ue 
  WHERE ue.is_ativa = true 
  LIMIT 1
)
WHERE empresa_id IS NULL;

-- Alterar colunas para NOT NULL
ALTER TABLE public.contatos 
ALTER COLUMN empresa_id SET NOT NULL;

ALTER TABLE public.prospeccoes 
ALTER COLUMN empresa_id SET NOT NULL;