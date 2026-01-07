-- Corrigir templates existentes que estão sem pri_telefone
UPDATE public.whatsapp_templates wt
SET pri_telefone = (
  SELECT REGEXP_REPLACE(ai.telefone, '[^0-9]', '', 'g')
  FROM public.agentes_ia ai 
  WHERE ai.empresa_id = wt.empresa_id 
    AND ai.nome = 'Pri'
    AND ai.telefone IS NOT NULL
    AND ai.telefone != ''
  LIMIT 1
)
WHERE wt.pri_telefone IS NULL;